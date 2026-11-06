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
/**
 * Link to the candidate the person picked, sending back what the Find showed. Asked whether its approved invoice is on
 * a Sales Order yet (11/6), the person says "not" unless the test says otherwise: those lines move, as before 11/6.
 */
const linkTo = (sql, found, cand, who = "u-owner", salesOrder = cand.plan.ok === "ask" ? "not" : undefined) =>
  L.setRebuildLinkFor(
    sql,
    {
      id: found.id,
      expect: { installId: found.installId, jobId: found.jobId },
      to: cand.target,
      seen: { own: found.own.version, current: found.current?.stamp ?? null, target: cand.project.stamp },
      ...(salesOrder ? { salesOrder } : {}),
    },
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
  const own = { version: "7:1:", state: "approved", lines: 2, total: 315, discount: null, onSalesOrder: false };
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
  // Its own invoice is approved, so it may be on a Sales Order in NetSuite already (Chuy, 11/6): Link asks, and says
  // what each answer does.
  const plan = R.planLink(r, t, "not");
  assert.deepEqual(plan, {
    ok: true,
    steps: ["link"],
    effects: [`Account: ${SHOP} → ${CAFE}.`, "Customer P.O.: PO-OLD → PO-77.", "Its invoice's 2 lines ($315.00) go on the ticket's charges."],
    lines: 2,
    total: 315,
    keepOwn: false,
    noteOwn: false,
  });
  const kept = R.planLink(r, t, "on");
  assert.deepEqual(kept, {
    ok: true,
    steps: ["link"],
    effects: [
      `Account: ${SHOP} → ${CAFE}.`,
      "Customer P.O.: PO-OLD → PO-77.",
      "Its invoice's 2 lines ($315.00) stay on it: it's on a Sales Order in NetSuite.",
      "Its parts and labor from now on are billed on the ticket's charges.",
    ],
    lines: 0,
    total: 0,
    keepOwn: true,
    noteOwn: true,
  });
  assert.deepEqual(R.planLink(r, t), { ok: "ask", question: "Its invoice is approved (2 lines, $315.00). Is it on a Sales Order in NetSuite yet?", not: plan, on: kept });
  // One line: the verbs agree.
  assert.equal(R.planLink({ ...r, own: { ...own, lines: 1, total: 45 } }, t, "not").effects[2], "Its invoice's 1 line ($45.00) goes on the ticket's charges.");
  assert.equal(R.planLink({ ...r, own: { ...own, lines: 1, total: 45 } }, t, "on").effects[2], "Its invoice's 1 line ($45.00) stays on it: it's on a Sales Order in NetSuite.");
  // The project's P.O. even when it has none, and said so.
  assert.equal(R.planLink(r, { ...t, po: null }, "not").effects[1], "Customer P.O.: PO-OLD → none (Service ticket SC-1 has none).");
  // Not approved, it was never on a Sales Order: nothing to ask. An answer sent anyway changes nothing.
  for (const state of ["none", "waiting"]) {
    for (const answer of [null, "on", "not"]) assert.notEqual(R.planLink({ ...r, own: { ...own, state } }, t, answer).keepOwn, true, `${state} ${answer}`);
  }
  assert.equal(R.planLink({ ...r, own: { ...own, state: "none" } }, t).ok, true);
  // Nor without lines: there's nothing to keep.
  assert.deepEqual([R.planLink({ ...r, own: { ...own, lines: 0, total: 0 } }, t, "on").keepOwn, R.planLink({ ...r, own: { ...own, lines: 0, total: 0 } }, t, "on").steps], [false, ["link"]]);
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
  // A billed project takes no lines, and no link at all (11/6 review, round 5): linked there, the rebuild could bill
  // nowhere, and its parts could go on it by hand once it reopened. Neither answer could link, so Link doesn't ask.
  assert.deepEqual(R.planLink(r, { ...t, closed: "is billed on SO-T-1" }), { ok: false, refusal: "Service ticket SC-1 is billed on SO-T-1, so this rebuild's 2 lines can't go on it." });
  assert.deepEqual(R.planLink(r, { ...t, closed: "is billed on SO-T-1" }, "on"), {
    ok: false,
    refusal: "Service ticket SC-1 is billed on SO-T-1, so nothing more can be billed there. Link it to an open ticket or install.",
  });
  assert.deepEqual(R.planLink({ ...r, own: { ...own, lines: 0, total: 0 } }, { ...t, closed: "is billed on SO-T-1" }), {
    ok: false,
    refusal: "Service ticket SC-1 is billed on SO-T-1, so nothing more can be billed there. Link it to an open ticket or install.",
  });
  // Refused: Walk-In, no account, a blocked project, Warehouse's waiting invoice, a discount, a locked unit.
  assert.equal(R.planLink(r, { ...t, customer: "Walk - In" }).refusal, "Service ticket SC-1 is on Walk-In, which is never a billing account. Give it the real account first.");
  assert.equal(R.planLink(r, { ...t, customer: " " }).refusal, "Service ticket SC-1 has no account. Give it one first.");
  assert.equal(R.planLink(r, { ...t, blocked: "Service ticket SC-1 is cancelled." }).refusal, "Service ticket SC-1 is cancelled.");
  assert.equal(R.planLink(r, { ...t, blocked: "Service ticket SC-1 is cancelled." }, "on").refusal, "Service ticket SC-1 is cancelled.");
  assert.equal(R.planLink({ ...r, own: { ...own, state: "waiting" } }, t).refusal, "This rebuild's invoice is waiting for an Admin to approve it (Warehouse saved it). Approve it first, then link.");
  // A discount can't ride along; on a Sales Order, it stays on its own invoice with the lines.
  const discounted = R.planLink({ ...r, own: { ...own, discount: { kind: "amount", value: 20 } } }, t);
  assert.equal(discounted.ok, "ask");
  assert.equal(
    discounted.not.refusal,
    "This rebuild's invoice has a discount ($20.00 off), which can't go on WO-4321 (Service ticket SC-1)'s bill. Take it off the rebuild's invoice first.",
  );
  assert.deepEqual([discounted.on.ok, discounted.on.keepOwn], [true, true]);
  // The unit lock holds either way: the account moves either way.
  assert.equal(R.planLink({ ...r, unitLock: "SN T-1 is locked by chuy, so this rebuild stays on its account while it has it." }, t).refusal, "SN T-1 is locked by chuy, so this rebuild stays on its account while it has it.");
  assert.equal(R.planLink({ ...r, unitLock: "SN T-1 is locked by chuy." }, t, "on").refusal, "SN T-1 is locked by chuy.");
  // The lock only matters when the account would change.
  assert.equal(R.planLink({ ...r, account: CAFE, unitLock: "locked" }, t, "not").ok, true);
  assert.equal(R.planLink({ ...r, account: CAFE, unitLock: "locked" }, t, "on").ok, true);

  // An Admin said so at an earlier Link, and its invoice hasn't changed since: its lines stay, without asking, whatever
  // answer comes (a "not yet" sent after that is turned down by setRebuildLink, not here).
  const onSo = { ...r, own: { ...own, onSalesOrder: true } };
  assert.deepEqual(R.planLink(onSo, t), { ...kept, noteOwn: false });
  assert.deepEqual(R.planLink(onSo, t, "not"), { ...kept, noteOwn: false });
  assert.equal(R.planLink(onSo, { ...t, closed: "is billed on SO-T-1" }).refusal, "Service ticket SC-1 is billed on SO-T-1, so nothing more can be billed there. Link it to an open ticket or install.");
  assert.equal(R.planLink({ ...onSo, own: { ...onSo.own, discount: { kind: "percent", value: 10 } } }, t).keepOwn, true);

  // Linked: Unlink brings the lines back, unless they are billed there or elsewhere.
  const current = { ...t, lines: 2, total: 315, moved: 2, linkedOpen: true, elsewhere: null };
  const linked = { account: CAFE, po: "PO-77", current, own: { version: null, state: "none", lines: 0, total: 0, discount: null, onSalesOrder: false }, unitLock: null };
  const unlinkPlan = {
    ok: true,
    steps: ["unlink"],
    effects: [
      "Its 2 lines ($315.00) come off the ticket's charges and back onto its own invoice, approved by you.",
      // Parts put on the open ticket by hand carry no key: they stay and bill there (11/6 review, round 3).
      "Any of its parts added on the ticket's charges by hand stay there and bill there. To bill them on its own invoice, take them off first.",
      `Its account (${CAFE}) and Customer P.O. stay as they are.`,
    ],
    lines: 2,
    total: 315,
    keepOwn: false,
    noteOwn: false,
  };
  assert.deepEqual(R.planLink(linked, null), unlinkPlan);
  assert.deepEqual(R.planUnlink(linked), unlinkPlan, "Unlink never asks");
  assert.deepEqual(R.planLink(linked, null, "on"), unlinkPlan, "nor takes an answer");
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
  assert.deepEqual(untouched.effects, [
    "None of its lines are on WO-4321 (Service ticket SC-1)'s bill.",
    "Service ticket SC-1 is billed on SO-T-2: any of its parts added there by hand stay billed there.",
    `Its account (${CAFE}) and Customer P.O. stay as they are.`,
  ]);
  const approvedInstall = { ...current, kind: "install", name: "Install #9", lines: 0, moved: 0, closed: "has an approved invoice" };
  assert.equal(R.planLink({ ...linked, current: approvedInstall }, null).refusal, "Install #9 has an approved invoice, and it was linked while that bill was open, so it stays linked: anything of it billed there stays billed.");
  assert.equal(R.planLink({ ...linked, current: { ...approvedInstall, linkedOpen: false } }, null).ok, true);
  assert.equal(R.planLink({ ...linked, current: { ...current, elsewhere: "ticket SC-9 (billed on SO-T-3)" } }, null).refusal, "Some of this rebuild's lines are on ticket SC-9 (billed on SO-T-3), so it stays linked.");
  // Linking it again to the same project: only a rebuild linked before 11/6 still has its own lines to move. Approved,
  // they may be on a Sales Order: yes only notes it, and nothing moves.
  assert.equal(R.planLink(linked, t).refusal, "This rebuild is already linked to WO-4321 (Service ticket SC-1).");
  const legacy = R.planLink({ ...linked, own }, t);
  assert.equal(legacy.ok, "ask");
  assert.deepEqual(legacy.not.steps, ["link"]);
  assert.deepEqual(legacy.on, {
    ok: true,
    steps: ["note"],
    effects: ["Its own invoice's 2 lines ($315.00) stay on it: it's on a Sales Order in NetSuite.", "Nothing else changes: it stays linked to WO-4321 (Service ticket SC-1)."],
    lines: 0,
    total: 0,
    keepOwn: true,
    noteOwn: true,
  });
  // Noted already: there's nothing more Link can do there.
  assert.equal(
    R.planLink({ ...linked, own: { ...own, onSalesOrder: true } }, t).refusal,
    "This rebuild is already linked to WO-4321 (Service ticket SC-1). Its own invoice's 2 lines ($315.00) stay on it: it's on a Sales Order in NetSuite.",
  );
  // The note checks the project like any link, but nothing goes on its bill, so a closed one is fine.
  assert.equal(R.planLink({ ...linked, own, current: { ...current, blocked: "Service ticket SC-1 is cancelled." } }, { ...t, blocked: "Service ticket SC-1 is cancelled." }).refusal, "Service ticket SC-1 is cancelled.");
  assert.deepEqual(R.planLink({ ...linked, own, current: { ...current, lines: 0, closed: "is billed on SO-T-8" } }, { ...t, closed: "is billed on SO-T-8" }, "on").steps, ["note"]);
  // Another project: off the old one first, then onto the new.
  const other = { ...t, kind: "install", id: 9, name: "Install #9", wo: "WO-5001", po: "PO-77" };
  const relink = R.planLink(linked, other);
  assert.deepEqual(relink.steps, ["unlink", "link"]);
  assert.deepEqual(relink.effects, [
    "It leaves WO-4321 (Service ticket SC-1): its 2 lines there come off the ticket's charges.",
    "Any of its parts added on the ticket's charges by hand stay there and bill there. To bill them on WO-5001 (Install #9), move them there by hand.",
    "Its invoice's 2 lines ($315.00) go on the install's invoice, waiting for an Admin to approve it.",
  ]);
  // A move off a closed bill (a link that may go) says its hand-added parts stay billed there, as Unlink does.
  assert.deepEqual(R.planLink({ ...linked, current: { ...current, lines: 0, moved: 0, linkedOpen: false, closed: "is billed on SO-T-5" } }, other).effects, [
    "It leaves WO-4321 (Service ticket SC-1).",
    "Service ticket SC-1 is billed on SO-T-5: any of its parts added there by hand stay billed there.",
    "It has no invoice lines yet. Its parts and labor are billed on the install's invoice from now on.",
  ]);
  // A project off the board bills nothing more: its hand-added parts just stay there.
  assert.deepEqual(R.planLink({ ...linked, current: { ...approvedInstall, closed: null, blocked: "Install #9 was taken off the board." } }, null).effects, [
    "None of its lines are on WO-4321 (Install #9)'s bill.",
    "Any of its parts added on the install's invoice by hand stay there.",
    `Its account (${CAFE}) and Customer P.O. stay as they are.`,
  ]);
  // It came to an install with a ticket merged in as billed: it stays, as on that ticket (11/6 review, round 3).
  const viaMerge = { ...approvedInstall, closed: null, linkedOpen: true, billedVia: "ticket SC-9 (billed on SO-T-6)" };
  assert.equal(R.planLink({ ...linked, current: viaMerge }, null).refusal, "This rebuild came over with ticket SC-9 (billed on SO-T-6) when that ticket was merged into an install, so it stays linked: what was billed there stays billed.");
  assert.equal(R.planLink({ ...linked, current: viaMerge }, t).refusal, "This rebuild came over with ticket SC-9 (billed on SO-T-6) when that ticket was merged into an install, so it stays linked: what was billed there stays billed.");
  // The merge sets it only for a link made while that ticket was open, so it alone decides (11/6 review, round 4).
  assert.equal(R.planLink({ ...linked, current: { ...viaMerge, linkedOpen: false } }, null).refusal, "This rebuild came over with ticket SC-9 (billed on SO-T-6) when that ticket was merged into an install, so it stays linked: what was billed there stays billed.");
  assert.equal(R.planLink({ ...linked, current: { ...viaMerge, closed: "has an approved invoice" } }, null).refusal, "This rebuild came over with ticket SC-9 (billed on SO-T-6) when that ticket was merged into an install, so it stays linked: what was billed there stays billed.");
  // A move to another WO checks the unlink first: lines billed on the old project stay there.
  assert.equal(
    R.planLink({ ...linked, current: { ...current, closed: "is billed on SO-T-4" } }, other).refusal,
    "Service ticket SC-1 is billed on SO-T-4, so this rebuild's 2 lines there stay billed, and it stays linked.",
  );
  // Its own lines can't go on a closed bill: Unlink, and Warehouse's saved invoice still needs an Admin after that.
  const billedT = { ...t, closed: "is billed on SO-T-7" };
  assert.equal(
    R.planLink({ ...linked, current: { ...current, lines: 0, moved: 0, linkedOpen: false, closed: "is billed on SO-T-7" }, own }, billedT, "not").refusal,
    "Service ticket SC-1 is billed on SO-T-7, so this rebuild's 2 lines can't go on it. Unlink it to bill them on its own invoice.",
  );
  assert.equal(
    R.planLink({ ...linked, current: { ...current, lines: 0, moved: 0, linkedOpen: false, closed: "is billed on SO-T-7" }, own: { ...own, state: "waiting", lines: 1, total: 45 } }, billedT).refusal,
    "Service ticket SC-1 is billed on SO-T-7, so this rebuild's 1 line can't go on it. Unlink it, then approve its own invoice (it's waiting for an Admin) to bill it there.",
  );
  // Linked already, its own invoice is locked: the way out starts with Unlink (11/6 review).
  assert.equal(
    R.planLink({ ...linked, own: { ...linked.own, state: "waiting", lines: 1, total: 5 } }, other).refusal,
    "This rebuild's own invoice is waiting for an Admin to approve it (Warehouse saved it). Unlink it, approve its invoice, then link it again.",
  );
  assert.equal(
    R.planLink({ ...linked, own: { ...own, discount: { kind: "percent", value: 5 } } }, t, "not").refusal,
    "This rebuild's invoice has a discount (5% off), which can't go on WO-4321 (Service ticket SC-1)'s bill. Unlink it, take the discount off its invoice, then link it again.",
  );
  // Moving to another WO with its own invoice on a Sales Order: nothing comes back from the old project, so its own
  // lines stay put. Lines that would come back can't sit next to the ones on its Sales Order.
  const leaving = { ...linked, current: { ...current, lines: 0, total: 0, moved: 0 }, own };
  assert.deepEqual(R.planLink(leaving, other, "on"), {
    ok: true,
    steps: ["unlink", "link"],
    effects: [
      "It leaves WO-4321 (Service ticket SC-1).",
      "Any of its parts added on the ticket's charges by hand stay there and bill there. To bill them on WO-5001 (Install #9), move them there by hand.",
      "Its invoice's 2 lines ($315.00) stay on it: it's on a Sales Order in NetSuite.",
      "Its parts and labor from now on are billed on the install's invoice.",
    ],
    lines: 0,
    total: 0,
    keepOwn: true,
    noteOwn: true,
  });
  assert.equal(R.planLink({ ...leaving, own: { ...own, onSalesOrder: true } }, other).noteOwn, false);
  // The new project still has to take a link: open, with a real account, and the unit lock holds.
  assert.equal(
    R.planLink(leaving, { ...other, closed: "has an approved invoice" }, "on").refusal,
    "Install #9 has an approved invoice, so nothing more can be billed there. Link it to an open ticket or install.",
  );
  assert.equal(R.planLink(leaving, { ...other, customer: "Walk - In" }, "on").refusal, "Install #9 is on Walk-In, which is never a billing account. Give it the real account first.");
  assert.equal(R.planLink({ ...leaving, unitLock: "SN T-2 is locked by chuy." }, { ...other, customer: "Test Other Cafe" }, "on").refusal, "SN T-2 is locked by chuy.");
  assert.equal(
    R.planLink({ ...linked, own: { ...own, onSalesOrder: true } }, other).refusal,
    "Its own invoice is on a Sales Order, so its 2 lines on WO-4321 (Service ticket SC-1) can't come back onto it on the way to WO-5001 (Install #9). Unlink it, bill those lines from its own invoice, then link it to WO-5001 (Install #9).",
  );
  const mixed = R.planLink({ ...linked, own }, other);
  assert.equal(mixed.ok, "ask");
  assert.deepEqual([mixed.not.ok, mixed.not.lines, mixed.on.ok], [true, 4, false], "not yet: all four move, as before");
  // Unlinking with its own invoice on a Sales Order: its lines stay there; any that come back aren't on it.
  const noted = { ...linked, own: { ...own, onSalesOrder: true } };
  assert.deepEqual(R.planLink(noted, null).effects, [
    "Its 2 lines ($315.00) come off the ticket's charges and back onto its own invoice, approved by you.",
    "They aren't on that invoice's Sales Order: bill them on a new one.",
    "Any of its parts added on the ticket's charges by hand stay there and bill there. To bill them on its own invoice, take them off first.",
    "Its own invoice keeps its 2 lines, on its Sales Order.",
    `Its account (${CAFE}) and Customer P.O. stay as they are.`,
  ]);
  assert.equal(R.planLink({ ...noted, current: { ...current, lines: 1, total: 45 } }, null).effects[1], "It isn't on that invoice's Sales Order: bill it on a new one.");
  // Remove's refusal names what works: Unlink, or only Merge installs for a rebuild held there.
  const two = [{ id: 1, title: "Test A", held: false }, { id: 2, title: "Test B", held: true }];
  assert.equal(R.removeLinkedInstallRefusal(9, two), "Rebuild #1 (Test A), Rebuild #2 (Test B) are linked to install #9 and bill there. Merge this install into the one to keep instead: Rebuild #2 (Test B) can't be unlinked.");
  assert.equal(R.removeLinkedInstallRefusal(9, [two[0]]), "Rebuild #1 (Test A) is linked to install #9 and bills there. Unlink it on the rebuild's Details first, or merge this install into the one to keep.");
  // The keys: the rebuild's id is its own colon-bounded field.
  assert.equal(isRebuildLineKey("rb:12:40", 12), true);
  assert.equal(isRebuildLineKey("rb:120:40", 12), false);
  assert.equal(isRebuildLineKey("pmkit:12:x", 12), false);
  assert.equal(R.rebuildBillsOnLock({ kind: "install", name: "Install #9", wo: "WO-5001" }, 0), "This rebuild bills on WO-5001 (Install #9): its parts and labor go on the install's invoice. Open the install to change them.");
  assert.equal(
    R.rebuildBillsOnLock({ kind: "service", name: "Service ticket SC-1", wo: null }, 1),
    "This rebuild bills on Service ticket SC-1: its parts and labor go on the ticket's charges. Open the ticket to change them. Its own invoice still has 1 line from before it was linked. Link on its Details can move it onto Service ticket SC-1's bill. To change it first, or to bill it on this invoice, Unlink it.",
  );
  // On a Sales Order, its own invoice's lines stay on it (Chuy, 11/6).
  assert.equal(
    R.rebuildBillsOnLock({ kind: "install", name: "Install #9", wo: "WO-5001" }, 2, true),
    "This rebuild bills on WO-5001 (Install #9): its parts and labor go on the install's invoice. Open the install to change them. Its own invoice's 2 lines stay on it: it's on a Sales Order in NetSuite.",
  );
  assert.match(R.rebuildBillsOnLock({ kind: "tlc", name: "TLC ticket #4", wo: null }, 1, true), /Its own invoice's 1 line stays on it: it's on a Sales Order in NetSuite\.$/);
  assert.equal(R.rebuildBillsOnLock({ kind: "install", name: "Install #9", wo: null }, 0, true), "This rebuild bills on Install #9: its parts and labor go on the install's invoice. Open the install to change them.");
});

test("migrations 0118 to 0122 only add: a column and an index on invoice lines, five functions, three columns on rebuilds and three on invoices; invoice_total works out totals as the app does", async () => {
  const names = ["0118_rebuild_link_billing", "0119_rebuild_link_lines", "0120_rebuild_link_open", "0121_rebuild_link_billed_with", "0122_rebuild_invoice_sales_order"];
  const text = names.map((n) => src(`migrations/${n}.sql`)).join(";\n");
  const statements = text.replace(/--.*$/gm, "").split(/;\s*(?=(?:alter|create)\b)/i).map((s) => s.trim().replace(/;$/, "")).filter(Boolean);
  for (const s of statements) {
    assert.match(
      s,
      /^(alter table invoice_lines add column if not exists source_key text|create index if not exists invoice_lines_source_key_idx|create or replace function (invoice_version|rebuild_lines_on|take_rebuild_lines|invoice_total|rebuild_invoice_on_so)\b|alter table rebuilds add column if not exists (link_lines int not null default 0|link_open boolean|link_billed_with int)$|alter table invoices add column if not exists (on_sales_order_at timestamptz|on_sales_order_by text|on_sales_order_version text)$)/i,
      s.slice(0, 80),
    );
  }
  assert.equal(statements.filter((s) => /^alter table invoices /i.test(s)).length, 3);
  // Read fresh: a statement that waited for a lock sees a note that committed meanwhile.
  assert.match(src("migrations/0122_rebuild_invoice_sales_order.sql"), /create or replace function rebuild_invoice_on_so\(rb int\) returns boolean language sql volatile as \$\$/);
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
  // Its invoice is approved, so each match asks first whether it's on a Sales Order in NetSuite yet (Chuy, 11/6).
  assert.equal(s.plan.ok, "ask");
  assert.equal(s.plan.question, "Its invoice is approved (2 lines, $315.00). Is it on a Sales Order in NetSuite yet?");
  assert.deepEqual(s.plan.not.effects, [`Account: ${SHOP} → ${CAFE}.`, "Customer P.O.: PO-OLD → PO-T-1.", "Its invoice's 2 lines ($315.00) go on the ticket's charges."]);
  assert.deepEqual(s.plan.on.effects, [
    `Account: ${SHOP} → ${CAFE}.`,
    "Customer P.O.: PO-OLD → PO-T-1.",
    "Its invoice's 2 lines ($315.00) stay on it: it's on a Sales Order in NetSuite.",
    "Its parts and labor from now on are billed on the ticket's charges.",
  ]);
  assert.equal(f.own.lines, 2);
  assert.equal(f.own.total, 315);
  assert.equal(f.own.onSalesOrder, false);

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
  assert.deepEqual(await L.listProjectRebuildsFor(sql, { type: "service", id: job }, "u-owner"), [{ id: rb, title: "Test grinder refurb", status: "In progress", removed: false, lines: 2, total: 315, onSalesOrder: 0 }]);
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
  // An Unlink from a sheet that read the ticket before its last change: nothing, and it says unlinked, not linked.
  await assert.rejects(
    L.setRebuildLinkFor(sql, { id: rb, expect: { installId: null, jobId: job }, to: null, seen: { own: v.own.version, current: "1", target: null } }, "u-owner"),
    { message: "This rebuild or its project changed since you looked, so nothing was unlinked. Look at it again, then unlink." },
  );
  assert.deepEqual(v.unlink.effects, [
    "Its 2 lines ($360.00) come off the ticket's charges and back onto its own invoice, approved by you.",
    "Any of its parts added on the ticket's charges by hand stay there and bill there. To bill them on its own invoice, take them off first.",
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
  assert.deepEqual(f.candidates[0].plan.not.effects, [
    "Customer P.O.: none → PO-I-1.",
    "Its invoice's 2 lines ($315.00) go on the install's invoice, waiting for an Admin to approve it.",
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
    `Any of its parts added on the ticket's charges by hand stay there and bill there. To bill them on WO-5000 (Install #${inst}), move them there by hand.`,
    "Customer P.O.: none → PO-I-1.",
    "Its invoice's 2 lines ($315.00) go on the install's invoice, waiting for an Admin to approve it.",
  ]);
  // The ticket changes after the move read it and before its unlink writes: nothing moves, and it says nothing was
  // linked (not "unlinked": the move is what was asked).
  const racing = Object.assign(async (...a) => sql(...a), {
    query: async (text, params) => {
      if (text.includes("take_rebuild_lines(")) await sql.query("update service_jobs set updated_at = now() + interval '1 second' where id = $1", [job]);
      return sql.query(text, params);
    },
  });
  await assert.rejects(linkTo(racing, g, g.candidates[0]), { message: "This rebuild or that project changed since you looked, so nothing was linked. Find the WO again." });
  assert.equal((await charges(sql, job)).length, 2, "still on the ticket");
  const g2 = await find(sql, rb, "5000");
  const out = await linkTo(sql, g2, g2.candidates[0]);
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
  const dplan = (await find(sql, drb, "1005")).candidates[0].plan;
  assert.equal(dplan.not.refusal, "This rebuild's invoice has a discount (15% off), which can't go on WO-1005 (Service ticket SC-RBL-5)'s bill. Take it off the rebuild's invoice first.");
  // On a Sales Order, the discount stays on its own invoice with the lines.
  assert.equal(dplan.on.ok, true);
  const df = await find(sql, drb, "1005");
  await assert.rejects(linkTo(sql, df, df.candidates[0]), { message: dplan.not.refusal });
  // Asked, a link with no answer is refused.
  await assert.rejects(linkTo(sql, df, df.candidates[0], "u-owner", null), { message: "Say whether this rebuild's invoice is on a Sales Order in NetSuite yet, then link." });
  assert.equal((await RB.rebuildRowOut(sql, drb)).jobId, null);

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
  assert.deepEqual(await sql.query(L.linkRebuildSql(), [rb, null, null, "install", inst, "chuy", f.own.version, f.candidates[0].project.stamp, "x", "y", false, false]), []);
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
  const none = await sql.query(L.linkRebuildSql(), [rb, null, null, "job", job, "chuy", st.own, st.stamp, "x", "y", false, false]);
  assert.deepEqual(none, []);
  assert.deepEqual(await charges(sql, job), []);
  assert.equal((await invoiceLines(sql, "rebuild", rb)).length, 2);
  await sql.query("update service_jobs set ns_so = null where id = $1", [job]);
  // Its own invoice approved again after the plan: the write takes nothing.
  await sql.query("update invoices set approved_at = now() + interval '5 seconds' where entity_type = 'rebuild' and entity_id = $1", [rb]);
  assert.deepEqual(await sql.query(L.linkRebuildSql(), [rb, null, null, "job", job, "chuy", st.own, st.stamp, "x", "y", false, false]), []);
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
  const link = async (rb, kind, id, stamp) => sql.query(L.linkRebuildSql(), [rb, null, null, kind, id, "chuy", await own(rb), stamp, "x", "y", false, false]);
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
  // The statement checks the same on its own (11/6 review, round 5): every other check of it passes here.
  const elsewhere = (x, i, v) => [x, i, null, "chuy", v.current.stamp, 0, v.own.version, null, null, null, null, "x", "y"];
  assert.deepEqual(await sql.query(L.unlinkRebuildSql(), elsewhere(rb, inst, w)), []);
  // Its lines on another install's invoice, the same.
  await sql.query("delete from ticket_charges where job_id = $1", [job]);
  const other = await install(sql, { wo: "WO-5001" });
  const inv = await idOf(sql, "insert into invoices (entity_type, entity_id, customer, total, submitted_by, submitted_at) values ('install', $1, $2, 90, 'wes', now()) returning id", [other, CAFE]);
  await sql.query("insert into invoice_lines (invoice_id, item, qty, rate, kind, sort, source_key) values ($1, 'TEST-BURR-64', 2, 45, 'part', 1, $2)", [inv, `rb:${rb}:900`]);
  const x = await L.getRebuildLinkFor(sql, rb, "u-owner");
  assert.equal(x.unlink.refusal, `Some of this rebuild's lines are on install #${other}'s invoice, so it stays linked.`);
  assert.deepEqual(await sql.query(L.unlinkRebuildSql(), elsewhere(rb, inst, x)), []);
  // With none elsewhere, the statement lets it go: the two checks were what kept it.
  await sql.query("delete from invoice_lines where invoice_id = $1", [inv]);
  const y = await L.getRebuildLinkFor(sql, rb, "u-owner");
  assert.equal(y.unlink.ok, true);
  assert.equal((await sql.query(L.unlinkRebuildSql(), elsewhere(rb, inst, y))).length, 1);
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

test("a ticket merged into an install as billed keeps the rebuild linked, through Merge installs too; no merge leaves one on a closed bill that took nothing of it, nor does Remove (11/6 review, rounds 3 to 5)", async () => {
  const { sql } = await fresh();
  const { archiveInstallFor, mergeInstallsFor } = await import("../src/lib/ops/install-projects.ts");
  const { mergeServiceJobs, mergeTicketsSql } = await import("../src/lib/ops/wo-duplicates.ts");
  const flags = (rb) => one(sql, "select install_id, job_id, link_open from rebuilds where id = $1", [rb]);
  const billedWith = async (rb) => (await one(sql, "select link_billed_with from rebuilds where id = $1", [rb])).link_billed_with;
  const linkOn = async (rb, wo, target) => {
    const f = await find(sql, rb, wo);
    return linkTo(sql, f, f.candidates.find((c) => c.target.kind === target.kind && c.target.id === target.id));
  };
  /** The merge statement's parameters for this preview, as mergeTicketIntoInstallFor sends them (unbilled, no discount or P.O.). */
  const mergeParams = (p, job, inst) => [job, inst, "chuy", p.stamps.job, p.stamps.install, p.stamps.head, p.note, p.moves.invoiceTotal, null, null, null, "", null, "", ""];
  const mergeIn = async (job, inst) => {
    const p = await M.previewTicketInstallMergeFor(sql, "u-owner", { jobId: job, installId: inst });
    assert.equal(p.refusal ?? null, null);
    await M.mergeTicketIntoInstallFor(sql, "u-owner", { jobId: job, installId: inst, stamps: p.stamps, billedSo: p.moves.billed?.so ?? "", billedOn: p.moves.billed?.on ?? "" });
  };
  const installInvoice = (id, approved) =>
    sql.query(
      "insert into invoices (entity_type, entity_id, customer, total, approved_by, approved_at, submitted_by, submitted_at) values ('install', $1, $2, 0, $3, $4, 'wes', now() - interval '2 days')",
      [id, CAFE, approved ? "chuy" : null, approved ? "2026-11-01T15:00:00Z" : null],
    );
  const HAND = "insert into ticket_charges (job_id, item, description, qty, rate, kind, sort) values ($1, 'TEST-BURR-64', 'Added by hand', 2, 45, 'part', 1)";

  // Linked empty while the ticket was open; its parts went on the ticket's Charges by hand; the ticket was billed on its
  // SO and merged into the install as billed. The ticket keeps those charges, billed, so the rebuild stays linked.
  const job = await ticket(sql, { wo: "WO-9701", status: "In progress" });
  const inst = await install(sql, { wo: "WO-9701" });
  const rb = await rebuild(sql);
  await linkOn(rb, "9701", { kind: "job", id: job });
  await sql.query(HAND, [job]);
  await sql.query("update service_jobs set ns_so = 'SO-MB-1', updated_at = now() where id = $1", [job]);
  await mergeIn(job, inst);
  assert.deepEqual(await flags(rb), { install_id: inst, job_id: null, link_open: true });
  assert.equal(await billedWith(rb), job, "the merge says which billed ticket it came with (0121)");
  // Its install has no invoice, yet Remove names only Merge installs: Unlink refuses the rebuild.
  await assert.rejects(archiveInstallFor(sql, "u-owner", inst), { message: /Merge this install into the one to keep instead: it can't be unlinked\.$/ });
  const v = await L.getRebuildLinkFor(sql, rb, "u-owner");
  assert.equal(v.current.billedVia, "ticket SC-RBL-1 (billed on SO-MB-1)");
  assert.equal(v.unlink.refusal, "This rebuild came over with ticket SC-RBL-1 (billed on SO-MB-1) when that ticket was merged into an install, so it stays linked: what was billed there stays billed.");
  await assert.rejects(unlink(sql, rb), { message: v.unlink.refusal });
  // Warehouse sees where it bills, not what it was billed on.
  assert.equal((await L.getRebuildLinkFor(sql, rb, "u-wh")).current.billedVia, null);
  // A move to another WO starts with the unlink, so it is refused too.
  const other = await ticket(sql, { wo: "WO-9702", status: "In progress" });
  const g = await find(sql, rb, "9702");
  assert.equal(g.candidates.find((c) => c.target.id === other).plan.refusal, v.unlink.refusal);
  // Its own invoice stays locked: it bills on the install.
  assert.match((await I.getInvoiceFor(sql, { type: "rebuild", id: rb }, "u-owner")).locked, /^This rebuild bills on WO-9701 \(Install #\d+\)/);
  // The statement keeps it as well: every other check of it passes here.
  const params = (x, i, w) => [x, i, null, "chuy", w.current.stamp, 0, w.own.version, null, null, null, null, "x", "y"];
  assert.deepEqual(await sql.query(L.unlinkRebuildSql(), params(rb, inst, v)), []);
  // The same into an install whose invoice is approved: still the billed ticket's reason, and it stays linked.
  const jobA = await ticket(sql, { wo: "WO-9711", status: "In progress" });
  const instA = await install(sql, { wo: "WO-9711" });
  await installInvoice(instA, true);
  const rbA = await rebuild(sql, { title: "Test approved-install refurb" });
  await linkOn(rbA, "9711", { kind: "job", id: jobA });
  await sql.query(HAND, [jobA]);
  await sql.query("update service_jobs set ns_so = 'SO-MB-2', updated_at = now() where id = $1", [jobA]);
  await mergeIn(jobA, instA);
  assert.deepEqual(await flags(rbA), { install_id: instA, job_id: null, link_open: true });
  const keptA = "This rebuild came over with ticket SC-RBL-3 (billed on SO-MB-2) when that ticket was merged into an install, so it stays linked: what was billed there stays billed.";
  assert.equal((await L.getRebuildLinkFor(sql, rbA, "u-owner")).unlink.refusal, keptA);
  // Merged on into another install whose invoice is approved: the billed ticket still keeps it.
  const keepA = await install(sql, { wo: "WO-9712" });
  await installInvoice(keepA, true);
  await mergeInstallsFor(sql, "u-owner", { keepId: keepA, dropId: instA });
  assert.deepEqual(await flags(rbA), { install_id: keepA, job_id: null, link_open: true });
  assert.equal(await billedWith(rbA), jobA);
  const onKeep = await L.getRebuildLinkFor(sql, rbA, "u-owner");
  assert.equal(onKeep.unlink.refusal, keptA);
  assert.deepEqual(await sql.query(L.unlinkRebuildSql(), params(rbA, keepA, onKeep)), [], "the statement keeps it on the keeper too");
  // Nor can its install be taken off the board: it bills there, and only Merge installs moves it (11/6 review, round 6).
  await assert.rejects(archiveInstallFor(sql, "u-owner", keepA), {
    message: `Rebuild #${rbA} (Test approved-install refurb) is linked to install #${keepA} and bills there. Merge this install into the one to keep instead: it can't be unlinked.`,
  });
  assert.equal((await one(sql, "select archived from installs where id = $1", [keepA])).archived, false);

  // A link from before 11/6 that a billed merge carried can go, as such links can (11/6 review, round 4): nothing marks
  // it, so once unlinked it links and unlinks anywhere, the merge's log notwithstanding.
  const jobL = await ticket(sql, { wo: "WO-9721", status: "In progress" });
  const instL = await install(sql, { wo: "WO-9721" });
  const old = await rebuild(sql, { title: "Test old-link refurb", account: CAFE });
  await sql.query("update rebuilds set job_id = $2 where id = $1", [old, jobL]);
  await sql.query(HAND, [jobL]);
  await sql.query("update service_jobs set ns_so = 'SO-MB-3', updated_at = now() where id = $1", [jobL]);
  await mergeIn(jobL, instL);
  assert.deepEqual([await flags(old), await billedWith(old)], [{ install_id: instL, job_id: null, link_open: null }, null]);
  await unlink(sql, old);
  for (const [wo, target] of [["9722", { kind: "job", id: await ticket(sql, { wo: "WO-9722", status: "In progress" }) }], ["9723", { kind: "install", id: await install(sql, { wo: "WO-9723" }) }]]) {
    await linkOn(old, wo, target);
    assert.equal((await flags(old)).link_open, true);
    const x = await L.getRebuildLinkFor(sql, old, "u-owner");
    assert.deepEqual([x.current.billedVia, x.unlink.ok], [null, true]);
    await unlink(sql, old);
  }

  // A ticket with no charges and an install whose invoice is approved: the merge would leave a rebuild linked to the
  // ticket on a bill that takes nothing of it, where it could bill nowhere. It's refused, saying so, and goes through
  // once the rebuild is unlinked. Onto an open invoice, the rebuild goes along, its link made while open.
  for (const approved of [true, false]) {
    const j2 = await ticket(sql, { wo: approved ? "WO-9801" : "WO-9811", status: "Scheduled" });
    const i2 = await install(sql, { wo: approved ? "WO-9801" : "WO-9811" });
    await installInvoice(i2, approved);
    const r2 = await rebuild(sql, { title: `Test merged refurb ${approved}` });
    await linkOn(r2, approved ? "9801" : "9811", { kind: "job", id: j2 });
    if (approved) {
      const p = await M.previewTicketInstallMergeFor(sql, "u-owner", { jobId: j2, installId: i2 });
      const callId = (await one(sql, "select call_id from service_jobs where id = $1", [j2])).call_id;
      assert.equal(p.refusal, `Rebuild #${r2} (Test merged refurb true) is linked to ${callId} (WO-9801), and Install #${i2}'s invoice is approved, so it couldn't bill there. Unlink it on the rebuild's Details first, then merge.`);
      // The statement refuses as well, its checks passed or not.
      assert.deepEqual(await sql.query(M.mergeTicketIntoInstallSql(), mergeParams(p, j2, i2)), []);
      await unlink(sql, r2);
      await mergeIn(j2, i2);
      assert.deepEqual(await flags(r2), { install_id: null, job_id: null, link_open: null });
    } else {
      await mergeIn(j2, i2);
      assert.deepEqual(await flags(r2), { install_id: i2, job_id: null, link_open: true });
      assert.equal((await L.getRebuildLinkFor(sql, r2, "u-owner")).unlink.ok, true);
      // Once that invoice is approved, it stays: its parts may be on it by hand. The statement keeps it too.
      await sql.query("update invoices set approved_by = 'chuy', approved_at = now() where entity_type = 'install' and entity_id = $1", [i2]);
      const y = await L.getRebuildLinkFor(sql, r2, "u-owner");
      assert.match(y.unlink.refusal, /^Install #\d+ has an approved invoice, and it was linked while that bill was open, so it stays linked/);
      assert.deepEqual(await sql.query(L.unlinkRebuildSql(), params(r2, i2, y)), []);
      await assert.rejects(archiveInstallFor(sql, "u-owner", i2), { message: /Merge this install into the one to keep instead: it can't be unlinked\.$/ });
    }
  }

  // A WO duplicate merged into a keeper billed on its SO or a NetSuite invoice, the same: refused until its rebuild is
  // unlinked. Onto an open keeper the rebuild goes along, its link made while open.
  for (const billed of ["so", "invoice", null]) {
    const wo = `WO-99${billed === "so" ? "01" : billed === "invoice" ? "02" : "03"}`;
    const keeper = await ticket(sql, { wo, status: "In progress", so: billed === "so" ? "SO-K-1" : null });
    if (billed === "invoice") {
      await sql.query("insert into ticket_invoices (job_id, ns_invoice, invoice_date, status, total, amount_remaining, source) values ($1, 'INV-K-1', '2026-10-22', 'Open', 90, 90, 'standalone')", [keeper]);
    }
    const extra = await ticket(sql, { wo, status: "In progress" });
    const r3 = await rebuild(sql, { title: `Test duplicate refurb ${billed}` });
    await linkOn(r3, wo.slice(3), { kind: "job", id: extra });
    assert.equal((await flags(r3)).link_open, true);
    if (billed) {
      const refused = `Rebuild #${r3} (Test duplicate refurb ${billed}) is linked to ticket #${extra}, and ticket #${keeper} is billed, so it couldn't bill there. Unlink it on the rebuild's Details first, then merge.`;
      assert.deepEqual(await mergeServiceJobs(sql, keeper, extra, "chuy"), { refused });
      assert.equal((await one(sql, "select duplicate_of from service_jobs where id = $1", [extra])).duplicate_of, null);
      // The statement refuses as well, its checks passed or not.
      const st = await sql.query("select id, updated_at::text as u from service_jobs where id = any($1::int[])", [[keeper, extra]]);
      const su = (id) => st.find((x) => Number(x.id) === id).u;
      const dupParams = [keeper, extra, "chuy", CAFE, null, null, null, null, null, "Test Tech", wo, null, null, null, null, null, "Normal", su(keeper), su(extra)];
      assert.deepEqual(await sql.query(mergeTicketsSql(), dupParams), []);
      await unlink(sql, r3);
      if (billed === "so") {
        // A rebuild taken off the board, and one linked before 11/6, don't stop it: they go along as they are.
        const gone = await rebuild(sql, { title: "Test removed refurb" });
        await linkOn(gone, wo.slice(3), { kind: "job", id: extra });
        await sql.query("update rebuilds set archived = true where id = $1", [gone]);
        const legacy = await rebuild(sql, { title: "Test legacy refurb", account: CAFE });
        await sql.query("update rebuilds set job_id = $2 where id = $1", [legacy, extra]);
        assert.equal((await mergeServiceJobs(sql, keeper, extra, "chuy"))?.refused, undefined);
        assert.deepEqual(await sql.query("select job_id from rebuilds where id = any($1::int[]) order by id", [[gone, legacy]]), [{ job_id: keeper }, { job_id: keeper }]);
        continue;
      }
      assert.equal((await mergeServiceJobs(sql, keeper, extra, "chuy"))?.refused, undefined);
      assert.deepEqual(await flags(r3), { install_id: null, job_id: null, link_open: null });
    } else {
      assert.equal((await mergeServiceJobs(sql, keeper, extra, "chuy"))?.refused, undefined);
      assert.deepEqual(await flags(r3), { install_id: null, job_id: keeper, link_open: true });
      await unlink(sql, r3);
    }
  }

  // Merge installs into a keeper whose invoice is approved, the same: refused until its rebuild is unlinked. Into one
  // whose invoice is open the rebuild goes along. One held on the drop's own approved invoice goes along held: the
  // merge leaves it no worse off.
  for (const kase of ["approved", "open", "held"]) {
    const n = { approved: 1, open: 2, held: 3 }[kase];
    const keep = await install(sql, { wo: `WO-96${n}1` });
    const drop = await install(sql, { wo: `WO-96${n}2` });
    await installInvoice(keep, kase !== "open");
    const r4 = await rebuild(sql, { title: `Test install-merge refurb ${kase}` });
    await linkOn(r4, `96${n}2`, { kind: "install", id: drop });
    assert.equal((await flags(r4)).link_open, true);
    if (kase === "held") await installInvoice(drop, true);
    if (kase === "approved") {
      await assert.rejects(mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: drop }), {
        message: `Rebuild #${r4} (Test install-merge refurb approved) is linked to install #${drop}, and install #${keep}'s invoice is approved, so it couldn't bill there. Unlink it on the rebuild's Details first, then merge.`,
      });
      assert.equal((await one(sql, "select archived from installs where id = $1", [drop])).archived, false);
      await unlink(sql, r4);
      await mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: drop });
      assert.deepEqual(await flags(r4), { install_id: null, job_id: null, link_open: null });
    } else {
      await mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: drop });
      assert.deepEqual(await flags(r4), { install_id: keep, job_id: null, link_open: true });
      assert.equal((await L.getRebuildLinkFor(sql, r4, "u-owner")).unlink.ok, kase === "open");
    }
  }

  // The keeper's invoice approved after Merge installs looked and before its statement ran: the statement reads the
  // approval itself and refuses (11/6 review, round 6).
  {
    const keep = await install(sql, { wo: "WO-9641" });
    const drop = await install(sql, { wo: "WO-9642" });
    await installInvoice(keep, false);
    const r5 = await rebuild(sql, { title: "Test raced install-merge refurb" });
    await linkOn(r5, "9642", { kind: "install", id: drop });
    const racing = Object.assign(async (...a) => sql(...a), {
      query: async (text, params) => {
        if (text.includes("rebuilds_moved as (")) await sql.query("update invoices set approved_by = 'chuy', approved_at = now() where entity_type = 'install' and entity_id = $1", [keep]);
        return sql.query(text, params);
      },
    });
    await assert.rejects(mergeInstallsFor(racing, "u-owner", { keepId: keep, dropId: drop }), { message: /^Rebuild #\d+ \(Test raced install-merge refurb\) is linked to install #\d+, and install #\d+'s invoice is approved, so it couldn't bill there\./ });
    assert.deepEqual(await flags(r5), { install_id: drop, job_id: null, link_open: true });
  }

  // Remove: an install with a rebuild linked is refused until it's unlinked; then it goes.
  const offInst = await install(sql, { wo: "WO-9631" });
  const offRb = await rebuild(sql, { title: "Test off-board refurb" });
  await linkOn(offRb, "9631", { kind: "install", id: offInst });
  await assert.rejects(archiveInstallFor(sql, "u-owner", offInst), {
    message: `Rebuild #${offRb} (Test off-board refurb) is linked to install #${offInst} and bills there. Unlink it on the rebuild's Details first, or merge this install into the one to keep.`,
  });
  await unlink(sql, offRb);
  // Changed after Remove read it (a link or a merge marks it changed): it removes nothing, and says so.
  const touching = Object.assign(async (...a) => sql(...a), {
    query: async (text, params) => {
      if (text.includes("update installs set archived = true")) await sql.query("update installs set updated_at = now() + interval '1 second' where id = $1", [offInst]);
      return sql.query(text, params);
    },
  });
  await assert.rejects(archiveInstallFor(touching, "u-owner", offInst), { message: "This install changed while you removed it, so nothing was removed. Look at it again." });
  // Removed by someone else after Remove read it: it says so.
  const beaten = Object.assign(async (...a) => sql(...a), {
    query: async (text, params) => {
      if (text.includes("update installs set archived = true")) await sql.query("update installs set archived = true, updated_at = now() + interval '2 seconds' where id = $1", [offInst]);
      return sql.query(text, params);
    },
  });
  await assert.rejects(archiveInstallFor(beaten, "u-owner", offInst), { message: "This install was removed already." });
  await sql.query("update installs set archived = false where id = $1", [offInst]);
  assert.deepEqual(await archiveInstallFor(sql, "u-owner", offInst), { ok: true });
  assert.deepEqual(await one(sql, "select archived from installs where id = $1", [offInst]), { archived: true });
  assert.equal((await one(sql, "select action, actor_name from activity where entity_type = 'install' and entity_id = $1 order by id desc limit 1", [offInst])).action, "removed");

  // The first one, marked on an install with no invoice, goes along into a keeper whose invoice is approved: its billed
  // ticket holds it, wherever it is.
  const keepB = await install(sql, { wo: "WO-9741" });
  await installInvoice(keepB, true);
  await mergeInstallsFor(sql, "u-owner", { keepId: keepB, dropId: inst });
  assert.deepEqual([await flags(rb), await billedWith(rb)], [{ install_id: keepB, job_id: null, link_open: true }, job]);
  // The column is what keeps it: the merge's log alone keeps nothing.
  await sql.query("update rebuilds set link_billed_with = null where id = $1", [rb]);
  await sql.query("update invoices set approved_at = null, approved_by = null where entity_type = 'install' and entity_id = $1", [keepB]);
  const u = await L.getRebuildLinkFor(sql, rb, "u-owner");
  assert.deepEqual([u.current.billedVia, u.unlink.ok], [null, true]);
  assert.equal((await sql.query(L.unlinkRebuildSql(), params(rb, keepB, u))).length, 1);
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
  assert.deepEqual(await one(sql, "select link_lines, link_open from rebuilds where id = $1", [rb]), { link_lines: 0, link_open: null }, "back to none, both");
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
  // A billed ticket takes no link at all (11/6 review, round 5): on its SO, or on a NetSuite invoice alone. The
  // statement refuses too, its check passed or not.
  const late = await rebuild(sql, { title: "Test late refurb" });
  const k = await find(sql, late, "4321");
  assert.equal(k.candidates[0].plan.refusal, "Service ticket SC-RBL-1 is billed on SO-T-11, so nothing more can be billed there. Link it to an open ticket or install.");
  await assert.rejects(linkTo(sql, k, k.candidates[0]), { message: k.candidates[0].plan.refusal });
  const lateRow = await RB.rebuildRowOut(sql, late);
  const linkParams = (x, cand, found) => [x, null, null, cand.target.kind, cand.target.id, "chuy", found.own.version, cand.project.stamp, "x", "y", false, false];
  assert.deepEqual(await sql.query(L.linkRebuildSql(), linkParams(late, k.candidates[0], k)), []);
  assert.deepEqual([lateRow.jobId, lateRow.installId], [null, null]);
  const inv = await ticket(sql, { wo: "WO-4331" });
  await sql.query("insert into ticket_invoices (job_id, ns_invoice, invoice_date, status, total, amount_remaining, source) values ($1, 'INV-T-12', '2026-10-22', 'Open', 90, 90, 'standalone')", [inv]);
  const n = await find(sql, late, "4331");
  assert.equal(n.candidates[0].plan.refusal, "Service ticket SC-RBL-2 is invoiced in NetSuite on INV-T-12, so nothing more can be billed there. Link it to an open ticket or install.");
  assert.deepEqual(await sql.query(L.linkRebuildSql(), linkParams(late, n.candidates[0], n)), []);
  // Linked while open, the bill closing, reopening and closing again keeps it: its parts may be on it by hand.
  await sql.query("update service_jobs set ns_so = null, updated_at = now() where id = $1", [job]);
  const reopened = await L.getRebuildLinkFor(sql, empty, "u-owner");
  assert.equal(reopened.unlink.ok, true, "open again, it can go: what was added by hand comes off first");
  await sql.query("update service_jobs set ns_so = 'SO-T-12', updated_at = now() where id = $1", [job]);
  assert.match((await L.getRebuildLinkFor(sql, empty, "u-owner")).unlink.refusal, /is billed on SO-T-12, and it was linked while that bill was open, so it stays linked/);
  // The same for an install: its invoice approved since an empty link keeps it, and an approved one takes no link.
  const ins2 = await install(sql, { wo: "WO-5500" });
  const e2 = await rebuild(sql, { title: "Test install refurb" });
  const m = await find(sql, e2, "5500");
  await linkTo(sql, m, m.candidates[0]);
  await sql.query("insert into invoices (entity_type, entity_id, customer, total, approved_by, approved_at) values ('install', $1, $2, 90, 'chuy', now())", [ins2, CAFE]);
  assert.match((await L.getRebuildLinkFor(sql, e2, "u-owner")).unlink.refusal, /^Install #\d+ has an approved invoice, and it was linked while that bill was open, so it stays linked/);
  const p = await find(sql, late, "5500");
  assert.equal(p.candidates[0].plan.refusal, `Install #${ins2} has an approved invoice, so nothing more can be billed there. Link it to an open ticket or install.`);
  assert.deepEqual(await sql.query(L.linkRebuildSql(), linkParams(late, p.candidates[0], p)), []);
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
  // Approved, its lines may be on a Sales Order (11/6): not yet, the discount can't move; yes only notes it.
  assert.equal(f.candidates[0].plan.not.refusal, "This rebuild's invoice has a discount (10% off), which can't go on WO-4321 (Service ticket SC-RBL-1)'s bill. Unlink it, take the discount off its invoice, then link it again.");
  assert.deepEqual(f.candidates[0].plan.on.steps, ["note"]);
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
  assert.equal(g.candidates[0].plan.not.ok, true);
  await linkTo(sql, g, g.candidates[0], "u-owner", "not");
  assert.equal(await head(sql, "rebuild", rb), undefined);
  // One linked to an install before 11/6 goes too once its invoice is approved, none of its lines there: the old list
  // put nothing on that bill. The statement agrees.
  const ins = await install(sql, { wo: "WO-4401" });
  const old = await rebuild(sql, { title: "Test old install refurb", account: CAFE });
  await sql.query("update rebuilds set install_id = $2 where id = $1", [old, ins]);
  await sql.query("insert into invoices (entity_type, entity_id, customer, total, approved_by, approved_at) values ('install', $1, $2, 90, 'chuy', now())", [ins, CAFE]);
  assert.equal((await L.getRebuildLinkFor(sql, old, "u-owner")).unlink.ok, true);
  await unlink(sql, old);
  assert.equal((await RB.rebuildRowOut(sql, old)).installId, null);
});

/* ------------------------------------------------------------------ on a Sales Order (Chuy, 11/6) */

const CHANGED_LINK = "This rebuild or that project changed since you looked, so nothing was linked. Find the WO again.";

test("its invoice on a Sales Order: Link asks, and yes keeps its lines on it, noted there, while only its later parts and labor go on the project", async () => {
  const { sql } = await fresh();
  const rb = await rebuild(sql, { po: "PO-OLD" });
  const ownId = await ownInvoice(sql, rb, PARTS);
  await sql.query("update invoices set po = 'PO-OLD' where id = $1", [ownId]);
  const job = await ticket(sql, { wo: "WO-4321", po: "PO-T-1", status: "In progress" });
  const before = await one(sql, "select approved_at::text as at, invoice_version('rebuild', $2) as v from invoices where id = $1", [ownId, rb]);
  const f = await find(sql, rb, "4321");
  assert.equal(f.candidates[0].plan.ok, "ask");

  // Yes: linked, it takes the ticket's account and P.O., and its lines stay on its own invoice, approved as it was.
  const out = await linkTo(sql, f, f.candidates[0], "u-owner", "on");
  assert.equal(out.message, "Linked to WO-4321 (Service ticket SC-RBL-1). Its invoice's 2 lines stay on it: it's on a Sales Order.");
  assert.deepEqual([out.row.jobId, out.row.account, out.row.po], [job, CAFE, "PO-T-1"]);
  assert.deepEqual(await charges(sql, job), [], "nothing went on the ticket");
  assert.equal((await invoiceLines(sql, "rebuild", rb)).length, 2);
  // The answer is kept on the invoice, at the version the person saw, which is unchanged.
  assert.deepEqual(
    await one(sql, "select approved_at::text as at, on_sales_order_by as by, on_sales_order_at is not null as noted, on_sales_order_version as v, invoice_version('rebuild', $2) as now from invoices where id = $1", [ownId, rb]),
    { at: before.at, by: "chuy", noted: true, v: before.v, now: before.v },
  );
  assert.deepEqual(await one(sql, "select link_lines, link_open from rebuilds where id = $1", [rb]), { link_lines: 0, link_open: true }, "an open bill took the link");
  assert.deepEqual(
    (await notes(sql)).map((n) => [n.entity_type, n.entity_id, n.actor_name, n.action, n.detail]),
    [
      ["rebuild", rb, "chuy", "linked", `Linked to WO-4321 (Service ticket SC-RBL-1), ${CAFE} · account ${SHOP} → ${CAFE} · Customer P.O. PO-T-1 · its invoice's 2 lines ($315.00) stayed on it: it's on a Sales Order`],
      ["service", job, "chuy", "updated", "Rebuild #1 (Test grinder refurb) linked · its own invoice's 2 lines ($315.00) are on a Sales Order"],
    ],
  );

  // Its own Invoice window: locked, saying the lines stay on it, and billed as it was approved (not the ticket's account).
  const lock = "This rebuild bills on WO-4321 (Service ticket SC-RBL-1): its parts and labor go on the ticket's charges. Open the ticket to change them. Its own invoice's 2 lines stay on it: it's on a Sales Order in NetSuite.";
  const view = await I.getInvoiceFor(sql, { type: "rebuild", id: rb }, "u-owner");
  assert.deepEqual([view.locked, view.lines.length, view.billTo.name, view.po], [lock, 2, SHOP, "PO-OLD"]);
  await assert.rejects(I.approveInvoiceFor(sql, { type: "rebuild", id: rb, lines: [{ item: "TEST-BURR-64", description: "", qty: 1, rate: 45 }], lineIds: [], discount: null, seen: view.version }, "u-owner"), { message: lock });
  // The ticket's list says where they bill; the old account's Invoices tab keeps it, with the P.O. it was approved with.
  assert.deepEqual(await L.listProjectRebuildsFor(sql, { type: "service", id: job }, "u-owner"), [
    { id: rb, title: "Test grinder refurb", status: "In progress", removed: false, lines: 0, total: 0, onSalesOrder: 2 },
  ]);
  assert.deepEqual((await I.listAccountInvoicesFor(sql, SHOP, "u-owner")).map((x) => [x.type, x.id, x.status, x.po]), [["rebuild", rb, "Approved", "PO-OLD"]]);
  // There again: nothing more to do.
  const again = await find(sql, rb, "4321");
  assert.equal(again.own.onSalesOrder, true);
  assert.equal(again.candidates[0].plan.refusal, "This rebuild is already linked to WO-4321 (Service ticket SC-RBL-1). Its own invoice's 2 lines ($315.00) stay on it: it's on a Sales Order in NetSuite.");

  // Unlink: nothing comes off the ticket, and its own invoice keeps its lines and the note.
  const v = await L.getRebuildLinkFor(sql, rb, "u-owner");
  assert.deepEqual(v.unlink.effects, [
    "None of its lines are on WO-4321 (Service ticket SC-RBL-1)'s bill.",
    "Any of its parts added on the ticket's charges by hand stay there and bill there. To bill them on its own invoice, take them off first.",
    "Its own invoice keeps its 2 lines, on its Sales Order.",
    `Its account (${CAFE}) and Customer P.O. stay as they are.`,
  ]);
  await unlink(sql, rb);
  assert.equal((await L.getRebuildLinkFor(sql, rb, "u-owner")).own.onSalesOrder, true);
  // Unlinked, its window opens again on the account as it is now: an approve would bill that one.
  const open = await I.getInvoiceFor(sql, { type: "rebuild", id: rb }, "u-owner");
  assert.deepEqual([open.locked, open.billTo.name, open.po], [null, CAFE, "PO-T-1"]);

  // Linked to another WO, its lines stay without asking. A "not yet" sent anyway is turned down.
  const inst = await install(sql, { wo: "WO-5000" });
  const g = await find(sql, rb, "5000");
  assert.deepEqual([g.candidates[0].plan.ok, g.candidates[0].plan.keepOwn, g.candidates[0].plan.noteOwn], [true, true, false]);
  await assert.rejects(linkTo(sql, g, g.candidates[0], "u-owner", "not"), { message: CHANGED_LINK });
  assert.equal((await linkTo(sql, g, g.candidates[0])).message, `Linked to WO-5000 (Install #${inst}). Its invoice's 2 lines stay on it: it's on a Sales Order.`);
  assert.equal(await head(sql, "install", inst), undefined, "the install's invoice takes nothing now");
  assert.equal((await invoiceLines(sql, "rebuild", rb)).length, 2);
  assert.equal((await one(sql, "select on_sales_order_by from invoices where id = $1", [ownId])).on_sales_order_by, "chuy", "the first answer stays");
  assert.equal(
    (await I.getInvoiceFor(sql, { type: "rebuild", id: rb }, "u-owner")).locked,
    `This rebuild bills on WO-5000 (Install #${inst}): its parts and labor go on the install's invoice. Open the install to change them. Its own invoice's 2 lines stay on it: it's on a Sales Order in NetSuite.`,
  );
  assert.deepEqual(await L.listProjectRebuildsFor(sql, { type: "install", id: inst }, "u-owner"), [
    { id: rb, title: "Test grinder refurb", status: "In progress", removed: false, lines: 0, total: 0, onSalesOrder: 2 },
  ]);

  // Approved again (unlinked first), the note no longer counts: Link asks again, and not yet moves them.
  await unlink(sql, rb);
  const w = await I.getInvoiceFor(sql, { type: "rebuild", id: rb }, "u-owner");
  await I.approveInvoiceFor(sql, { type: "rebuild", id: rb, lines: w.lines.map((l) => ({ item: l.item, description: l.description, qty: l.qty, rate: l.rate })), lineIds: [], discount: null, seen: w.version }, "u-owner");
  const h = await find(sql, rb, "5000");
  assert.deepEqual([h.own.onSalesOrder, h.candidates[0].plan.ok], [false, "ask"]);
  await linkTo(sql, h, h.candidates[0], "u-owner", "not");
  assert.equal((await invoiceLines(sql, "install", inst)).filter((l) => isRebuildLineKey(l.source_key, rb)).length, 2);
  assert.equal(await head(sql, "rebuild", rb), undefined, "its own invoice, and the note with it, is gone");
});

test("a rebuild linked before 11/6 with its own lines: yes only notes that they're on a Sales Order, and nothing moves", async () => {
  const { sql } = await fresh();
  const job = await ticket(sql, { wo: "WO-4321", po: "PO-T-1", status: "In progress" });
  const rb = await rebuild(sql, { account: CAFE });
  await sql.query("update rebuilds set job_id = $2 where id = $1", [rb, job]);
  await ownInvoice(sql, rb, PARTS, { customer: CAFE });
  const f = await find(sql, rb, "4321");
  assert.deepEqual([f.candidates[0].plan.ok, f.candidates[0].plan.on.steps, f.candidates[0].plan.not.steps], ["ask", ["note"], ["link"]]);
  // Not noted yet, the ticket's list doesn't call them on a Sales Order.
  assert.equal((await L.listProjectRebuildsFor(sql, { type: "service", id: job }, "u-owner"))[0].onSalesOrder, 0);
  const out = await linkTo(sql, f, f.candidates[0], "u-owner", "on");
  assert.equal(out.message, "Noted: its invoice's 2 lines are on a Sales Order, so they stay on it.");
  assert.deepEqual(await charges(sql, job), []);
  assert.equal((await invoiceLines(sql, "rebuild", rb)).length, 2);
  assert.equal((await one(sql, "select rebuild_invoice_on_so($1) as s", [rb])).s, true);
  assert.equal((await L.listProjectRebuildsFor(sql, { type: "service", id: job }, "u-owner"))[0].onSalesOrder, 2);
  // The rebuild row is as it was; only its history says so.
  assert.deepEqual(await one(sql, "select job_id, link_lines, link_open from rebuilds where id = $1", [rb]), { job_id: job, link_lines: 0, link_open: null });
  assert.deepEqual((await notes(sql)).map((n) => [n.entity_type, n.entity_id, n.actor_name, n.action, n.detail]), [
    ["rebuild", rb, "chuy", "updated", "Its invoice's 2 lines ($315.00) are on a Sales Order in NetSuite, so they stay on it"],
  ]);
  assert.equal(
    (await I.getInvoiceFor(sql, { type: "rebuild", id: rb }, "u-owner")).locked,
    "This rebuild bills on WO-4321 (Service ticket SC-RBL-1): its parts and labor go on the ticket's charges. Open the ticket to change them. Its own invoice's 2 lines stay on it: it's on a Sales Order in NetSuite.",
  );
  // Sent again from the same Find: yes has nothing more to do, and not yet would move what's on it.
  await assert.rejects(linkTo(sql, f, f.candidates[0], "u-owner", "on"), /^Error: This rebuild is already linked to WO-4321 \(Service ticket SC-RBL-1\)\. Its own invoice's 2 lines/);
  await assert.rejects(linkTo(sql, f, f.candidates[0], "u-owner", "not"), { message: CHANGED_LINK });
  assert.deepEqual(await charges(sql, job), []);
  assert.equal((await notes(sql)).length, 1);

  // Another linked before 11/6, moved to another WO with yes: it leaves the first ticket, nothing moves, and the answer
  // is noted with the new link.
  const other = await rebuild(sql, { title: "Test old refurb", account: CAFE });
  await sql.query("update rebuilds set job_id = $2 where id = $1", [other, job]);
  await ownInvoice(sql, other, [PARTS[0]], { customer: CAFE });
  const next = await ticket(sql, { wo: "WO-4400", status: "In progress" });
  const g = await find(sql, other, "4400");
  assert.deepEqual([g.candidates[0].plan.ok, g.candidates[0].plan.on.steps, g.candidates[0].plan.on.noteOwn], ["ask", ["unlink", "link"], true]);
  assert.equal((await linkTo(sql, g, g.candidates[0], "u-owner", "on")).message, "Moved from WO-4321 (Service ticket SC-RBL-1) to WO-4400 (Service ticket SC-RBL-2). Its invoice's 1 line stays on it: it's on a Sales Order.");
  assert.deepEqual([(await RB.rebuildRowOut(sql, other)).jobId, (await charges(sql, next)).length, (await invoiceLines(sql, "rebuild", other)).length], [next, 0, 1]);
  assert.equal((await one(sql, "select rebuild_invoice_on_so($1) as s", [other])).s, true);
});

test("every Sales Order check of the link and note statements holds on its own: an answer that no longer fits writes nothing", async () => {
  const { sql } = await fresh();
  const STAMP = (id) => one(sql, "select (extract(epoch from updated_at) * 1000000)::bigint::text as s from service_jobs where id = $1", [id]).then((r) => r.s);
  const own = (id) => one(sql, "select invoice_version('rebuild', $1) as v", [id]).then((r) => r.v);
  const link = async (rb, job, keep, note) => sql.query(L.linkRebuildSql(), [rb, null, null, "job", job, "chuy", await own(rb), await STAMP(job), "x", "y", keep, note]);
  const job = await ticket(sql, { wo: "WO-6101", status: "In progress" });
  // Kept on a Sales Order only from an approved invoice with lines: not a draft, an empty one, or none.
  const draft = await rebuild(sql);
  const draftInv = await ownInvoice(sql, draft, [PARTS[0]]);
  await sql.query("update invoices set approved_at = null, approved_by = null where id = $1", [draftInv]);
  assert.deepEqual(await link(draft, job, true, true), [], "not approved");
  const empty = await rebuild(sql);
  await ownInvoice(sql, empty, []);
  assert.deepEqual(await link(empty, job, true, true), [], "no lines");
  const none = await rebuild(sql);
  assert.deepEqual(await link(none, job, true, true), [], "no invoice");
  // A note goes only with lines kept.
  const loose = await rebuild(sql);
  await ownInvoice(sql, loose, [PARTS[0]]);
  assert.deepEqual(await link(loose, job, false, true), [], "a note with the lines moving");
  // An Admin said it's on a Sales Order: a move takes nothing, and a second note doesn't write over the first.
  const rb = await rebuild(sql);
  const inv = await ownInvoice(sql, rb, PARTS);
  await sql.query("update invoices set on_sales_order_at = now(), on_sales_order_by = 'dana', on_sales_order_version = invoice_version('rebuild', $2) where id = $1", [inv, rb]);
  assert.deepEqual(await link(rb, job, false, false), [], "a move of lines on a Sales Order");
  assert.deepEqual(await link(rb, job, true, true), [], "noted twice");
  assert.deepEqual(await charges(sql, job), []);
  // Kept with the note there already: linked, nothing moves, and the note is the first one.
  const kept = await link(rb, job, true, false);
  assert.deepEqual([kept.length, kept[0].moved, kept[0].noted], [1, 0, 0]);
  assert.deepEqual(await one(sql, "select on_sales_order_by as by, rebuild_invoice_on_so($2) as fresh from invoices where id = $1", [inv, rb]), { by: "dana", fresh: true });
  assert.equal((await invoiceLines(sql, "rebuild", rb)).length, 2);
  // Approved again, the note no longer counts, and the lines can move.
  const later = await rebuild(sql);
  const laterInv = await ownInvoice(sql, later, [PARTS[0]]);
  await sql.query("update invoices set on_sales_order_at = now(), on_sales_order_by = 'dana', on_sales_order_version = invoice_version('rebuild', $2) where id = $1", [laterInv, later]);
  await sql.query("update invoices set approved_at = approved_at + interval '1 second' where id = $1", [laterInv]);
  assert.equal((await one(sql, "select rebuild_invoice_on_so($1) as s", [later])).s, false);
  assert.equal((await link(later, job, false, false)).length, 1);
  // A discount stays with the lines it's on.
  const disc = await rebuild(sql);
  await ownInvoice(sql, disc, [PARTS[0]], { discount: { kind: "percent", value: 10 } });
  const job2 = await ticket(sql, { wo: "WO-6102", status: "In progress" });
  assert.deepEqual(await link(disc, job2, false, false), [], "a discount can't move");
  const d = await link(disc, job2, true, true);
  assert.deepEqual([d.length, d[0].moved, d[0].noted], [1, 0, 1]);

  // The note statement: still linked there, approved with lines, at the version seen, and not noted yet.
  const note = (x, jobId, seen) => sql.query(L.noteRebuildSalesOrderSql(), [x, null, jobId, "chuy", seen, "noted"]).then((r) => r[0].noted);
  const legacy = await rebuild(sql, { account: CAFE });
  const legInv = await ownInvoice(sql, legacy, PARTS, { customer: CAFE });
  assert.equal(await note(legacy, job, await own(legacy)), 0, "not linked there");
  assert.equal(await note(legacy, null, await own(legacy)), 0, "not linked at all");
  await sql.query("update rebuilds set job_id = $2 where id = $1", [legacy, job]);
  assert.equal(await note(legacy, job, `${legInv}:1:`), 0, "another version");
  await sql.query("update invoices set approved_at = null, approved_by = null, submitted_at = now(), submitted_by = 'wes' where id = $1", [legInv]);
  assert.equal(await note(legacy, job, await own(legacy)), 0, "waiting, not approved");
  await sql.query("update invoices set approved_at = now(), approved_by = 'chuy', submitted_at = null, submitted_by = null where id = $1", [legInv]);
  await sql.query("update rebuilds set archived = true where id = $1", [legacy]);
  assert.equal(await note(legacy, job, await own(legacy)), 0, "off the board");
  await sql.query("update rebuilds set archived = false where id = $1", [legacy]);
  const bare = await rebuild(sql, { account: CAFE });
  await ownInvoice(sql, bare, [], { customer: CAFE });
  await sql.query("update rebuilds set job_id = $2 where id = $1", [bare, job]);
  assert.equal(await note(bare, job, await own(bare)), 0, "no lines");
  const noted = async () => (await notes(sql)).filter((n) => n.detail === "noted").map((n) => [n.entity_type, n.entity_id, n.actor_name, n.action]);
  assert.deepEqual(await noted(), [], "a note that writes nothing says nothing");
  assert.equal(await note(legacy, job, await own(legacy)), 1);
  assert.equal(await note(legacy, job, await own(legacy)), 0, "noted already");
  assert.deepEqual(await noted(), [["rebuild", legacy, "chuy", "updated"]]);
  assert.equal((await one(sql, "select on_sales_order_version = invoice_version('rebuild', $2) as fresh from invoices where id = $1", [legInv, legacy])).fresh, true);
  // The note counts only on an approved invoice with lines, however it got there.
  const mark = (id) => sql.query("update invoices set on_sales_order_at = now(), on_sales_order_by = 'dana', on_sales_order_version = invoice_version('rebuild', $1) where entity_type = 'rebuild' and entity_id = $1", [id]);
  const onSo = (id) => one(sql, "select rebuild_invoice_on_so($1) as s", [id]).then((r) => r.s);
  const wait = await rebuild(sql, { account: "Katz Coffee Service Dept." });
  await ownInvoice(sql, wait, [PARTS[0]], { state: "waiting", customer: "Katz Coffee Service Dept." });
  await mark(wait);
  const blank = await rebuild(sql);
  await ownInvoice(sql, blank, []);
  await mark(blank);
  assert.deepEqual([await onSo(wait), await onSo(blank), await onSo(none)], [false, false, false]);
});

test("moving to another WO with its invoice on a Sales Order stops if that invoice changes between the unlink and the link", async () => {
  const { sql } = await fresh();
  const rb = await rebuild(sql);
  await ownInvoice(sql, rb, PARTS);
  await ticket(sql, { wo: "WO-6201", status: "In progress" });
  const second = await ticket(sql, { wo: "WO-6202", status: "In progress" });
  const f = await find(sql, rb, "6201");
  await linkTo(sql, f, f.candidates[0], "u-owner", "on");
  const bump = () => sql.query("update invoices set approved_at = approved_at + interval '1 second' where entity_type = 'rebuild' and entity_id = $1", [rb]);
  /** The database, with `then` run right after (or before) one statement: a write that lands in that moment. */
  const around = (statement, then, after = true) =>
    Object.assign(async (s, ...v) => sql(s, ...v), {
      query: async (text, params) => {
        if (!after && text === statement) await then();
        const rows = await sql.query(text, params);
        if (after && text === statement) await then();
        return rows;
      },
    });
  // Approved again right after the unlink: the move checks its own invoice is still the one the person answered for.
  const g = await find(sql, rb, "6202");
  assert.deepEqual([g.candidates[0].plan.keepOwn, g.candidates[0].plan.steps], [true, ["unlink", "link"]]);
  await assert.rejects(linkTo(around(L.unlinkRebuildSql(), bump), g, g.candidates[0]), {
    message: `Unlinked from WO-6201 (Service ticket SC-RBL-1). It wasn't linked to WO-6202 (Service ticket SC-RBL-2): ${CHANGED_LINK}`,
  });
  assert.deepEqual([(await RB.rebuildRowOut(sql, rb)).jobId, (await charges(sql, second)).length, (await invoiceLines(sql, "rebuild", rb)).length], [null, 0, 2]);
  // Answered again, linked, then moved: approved again just before the link statement, the statement stops it.
  const h = await find(sql, rb, "6201");
  await linkTo(sql, h, h.candidates[0], "u-owner", "on");
  const k = await find(sql, rb, "6202");
  await assert.rejects(linkTo(around(L.linkRebuildSql(), bump, false), k, k.candidates[0]), {
    message: `Unlinked from WO-6201 (Service ticket SC-RBL-1). It wasn't linked to WO-6202 (Service ticket SC-RBL-2): ${CHANGED_LINK}`,
  });
  assert.equal((await one(sql, "select rebuild_invoice_on_so($1) as s", [rb])).s, false, "nothing noted on what changed");
  assert.deepEqual(await charges(sql, second), []);
  // A not-yet move that meets a note between its unlink and its link (on the lines that came back) stops too, rather
  // than keep lines the person said aren't on a Sales Order, or move ones an Admin says are.
  const moving = await rebuild(sql, { title: "Test moving refurb" });
  await ownInvoice(sql, moving, [PARTS[0]]);
  const n = await find(sql, moving, "6201");
  await linkTo(sql, n, n.candidates[0], "u-owner", "not");
  await ownInvoice(sql, moving, [PARTS[1]]);
  const noteBack = () =>
    sql.query("update invoices set on_sales_order_at = now(), on_sales_order_by = 'dana', on_sales_order_version = invoice_version('rebuild', $1) where entity_type = 'rebuild' and entity_id = $1", [moving]);
  const p = await find(sql, moving, "6202");
  assert.equal(p.candidates[0].plan.ok, "ask");
  await assert.rejects(linkTo(around(L.unlinkRebuildSql(), noteBack), p, p.candidates[0], "u-owner", "not"), {
    message: `Unlinked from WO-6201 (Service ticket SC-RBL-1). Its 1 line ($90.00) is back on its own invoice. It wasn't linked to WO-6202 (Service ticket SC-RBL-2): ${CHANGED_LINK}`,
  });
  assert.deepEqual(await charges(sql, second), []);
  // Nothing in between: it moves, its lines staying on its own invoice.
  const m = await find(sql, rb, "6202");
  assert.equal(m.candidates[0].plan.ok, "ask", "approved since its note, it asks again");
  assert.equal((await linkTo(sql, m, m.candidates[0], "u-owner", "on")).message, "Linked to WO-6202 (Service ticket SC-RBL-2). Its invoice's 2 lines stay on it: it's on a Sales Order.");
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
    assert.deepEqual(v.own, { version: null, state: "none", lines: 0, total: 0, discount: null, onSalesOrder: false }, who);
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
  // Asked whether its invoice is on a Sales Order (11/6): two answers, each showing what it does, and the answer picked
  // goes with the link. A new Find starts the answers over.
  assert.match(field, /\{c\.plan\.ok === "ask" \? \(/);
  assert.match(field, /data-testid=\{`rebuild-link-answer-\$\{a\}`\}/);
  assert.match(field, /aria-pressed=\{answer === a\}/);
  assert.match(field, /plan=\{c\.plan\[answer\]\}/);
  assert.match(field, /onGo=\{\(\) => go\.mutate\(\{ base: found, to: c, salesOrder: answer \}\)\}/);
  assert.match(field, /salesOrder: q\.salesOrder \?\? null,/);
  assert.equal(field.match(/setAnswers\(\{\}\);/g)?.length, 2, "on a new Find, and after a link");
  assert.match(sheet, /link\.data\?\.own\.onSalesOrder \? ` Its own invoice's \$\{lineCount\(link\.data\.own\.lines\)\} \$\{link\.data\.own\.lines === 1 \? "stays" : "stay"\} on it: it's on a Sales Order in NetSuite\.` : ""/);
  assert.match(src("src/components/desk/project-rebuilds.tsx"), /\{r\.onSalesOrder \? ` · its own invoice's \$\{lineCount\(r\.onSalesOrder\)\} \$\{r\.onSalesOrder === 1 \? "is" : "are"\} on a Sales Order` : ""\}/);
  // The ticket (both layouts) and the install show the rebuilds billed there.
  const job = src("src/components/desk/job-sheet.tsx");
  assert.equal(job.match(/<ProjectRebuilds type=\{j\.kind === "tlc" \? "tlc" : "service"\} id=\{j\.id\} key=\{`rebuilds-\$\{j\.id\}`\} \/>/g)?.length, 2);
  assert.match(src("src/components/desk/entity-sheets.tsx"), /<ProjectRebuilds type="install" id=\{row\.id\} inset key=\{`rebuilds-install-\$\{row\.id\}`\} \/>/);
  // Rebuild lines keep their keys through the Charges panel and an install's approve.
  assert.match(src("src/lib/ops/charges-api.ts"), /regex\(\/\^\(pmkit\|mp\|rb\):\/\)/);
  assert.match(src("src/lib/ops/invoice-api.ts"), /regex\(\/\^\(pmkit\|mp\|rb\):\/\)/);
});
