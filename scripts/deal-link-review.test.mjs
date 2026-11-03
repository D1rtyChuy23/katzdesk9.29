// A completed deal's link to an install, for an Admin to review (Chuy, 11/3). Asked whether a deal marked complete should
// link only to an open install: "yes link and mark for review to approve", then "Link now, Admin approves". A deal marked
// complete with no install of its own takes the account's newest OPEN install with no deal (never a finished one), or a
// new install is made for it; either way an Admin approves it, and an Admin can unlink a linked one, which puts the deal
// back on the Handoff page. All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const api = await import("../src/lib/ops/api.ts");
const R = await import("../src/lib/ops/deal-review.ts");
const { todayChicago, weekBounds, addDays } = await import("../src/lib/ops/clock.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();
const CAFE = "Test Roastery - Midtown";
const OTHER = "Test Bakery - Uptown";
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function wrap(query) {
  return Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
}
async function fresh() {
  const pg = new PGlite();
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  const sql = wrap(async (text, params) => (await pg.query(text, params)).rows);
  await pg.query(
    `insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values
       ('u-owner', 'boss', true, true, 'admin'),
       ('u-admin', 'ada', true, false, 'admin'),
       ('u-rep', 'rita', true, false, 'sales'),
       ('u-tech', 'tess', true, false, 'service')`,
  );
  return { pg, sql };
}
/** The same handle, with `action` run once right after the first query whose text matches `when` (a write racing in). */
function racing(sql, when, action) {
  let fired = false;
  return wrap(async (text, params) => {
    const rows = await sql.query(text, params);
    if (!fired && when.test(text)) {
      fired = true;
      await action();
    }
    return rows;
  });
}
const one = async (pg, text, params) => (await pg.query(text, params)).rows[0];
const insertRow = async (pg, table, f) => {
  const cols = Object.keys(f);
  return Number((await one(pg, `insert into ${table} (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`, Object.values(f))).id);
};
let n = 0;
const deal = (pg, f = {}) => insertRow(pg, "deals", { customer: CAFE, producer: "Rita", ...f });
const install = (pg, f = {}) => insertRow(pg, "installs", { received: addDays(todayChicago(), -4), customer: CAFE, equip_status: "Not Ready", wo: `WO-${7100 + ++n}`, ...f });
const row = (pg, id) => one(pg, "select id, deal_id, deal_review, deal_review_at, archived, machines from installs where id = $1", [id]);
const dealRow = (pg, id) => one(pg, "select id, handed_off, unlinked_installs from deals where id = $1", [id]);
const complete = (sql, id, user = "u-rep") => api.updateDealFor(sql, { id, completion: "complete" }, user);
const installsOf = async (pg, dealId) => (await pg.query("select id, deal_review from installs where deal_id = $1 and archived = false order by id", [dealId])).rows;
const BREWER = JSON.stringify([{ equipment: "Test Brewer TB-1", serial: "", powerVoltage: "120", ownership: "Sold" }]);

test("the review's words, and the toasts", () => {
  assert.equal(R.dealReviewOf("linked"), "linked");
  assert.equal(R.dealReviewOf("made"), "made");
  for (const v of [null, undefined, "", "Linked", "approved", 1]) assert.equal(R.dealReviewOf(v), null);
  assert.equal(R.dealReviewBadge("linked"), "Deal link to review");
  assert.equal(R.dealReviewBadge("made"), "New install to review");
  assert.match(R.dealReviewText("linked"), /newest open install with no deal\. An Admin approves the link or unlinks it\.$/);
  assert.match(R.dealReviewText("made"), /no open install with no deal\. An Admin approves it; if it isn't needed, remove it from the install list\.$/);
  assert.match(R.DEAL_UNLINK_CONFIRM, /keeps its own work\. The deal goes back to the Handoff page's completed deals, and its next handoff won't pick this install again\.$/);
  assert.equal(R.dealReviewToast({ approved: true, kind: "linked", backOnHandoff: false }), "Deal link approved");
  assert.equal(R.dealReviewToast({ approved: true, kind: "made", backOnHandoff: false }), "Install approved for its deal");
  assert.equal(R.dealReviewToast({ approved: false, kind: "linked", backOnHandoff: true }), "Unlinked. The deal is back on the Handoff page.");
  assert.equal(R.dealReviewToast({ approved: false, kind: "linked", backOnHandoff: false }), "Unlinked. The deal is still on another install.");
  assert.equal(R.handoffToast({ kind: "linked", installId: 4 }), "Linked to the account's open install, for an Admin to review.");
  assert.equal(R.handoffToast({ kind: "made", installId: 4 }), "Install made for the deal, for an Admin to review.");
  assert.equal(R.handoffToast({ kind: "had", installId: 4 }), "That deal is on the install board already.");
  assert.equal(R.handoffToast(null), "That deal isn't on the Pipeline anymore.");
});

test("marked complete, a deal takes the account's newest open install with no deal, for review; never a finished one", async () => {
  const { pg, sql } = await fresh();
  try {
    const olderOpen = await install(pg);
    const otherDeal = await deal(pg);
    const taken = await install(pg, { deal_id: otherDeal });
    const finished = await install(pg, { complete: true, equip_status: "Installed" });
    const statusOnly = await install(pg, { equip_status: "Installed" });
    const elsewhere = await install(pg, { customer: OTHER });
    const d = await deal(pg, { customer: "  test roastery - MIDTOWN " });
    await complete(sql, d);
    const linked = await row(pg, olderOpen);
    assert.equal(linked.deal_id, d, "the newest open install with no deal: not a finished one, not another deal's");
    assert.equal(linked.deal_review, "linked");
    assert.ok(linked.deal_review_at, "with the time it was linked");
    for (const id of [finished, statusOnly, elsewhere]) assert.equal((await row(pg, id)).deal_id, null, `install #${id} keeps no deal`);
    assert.equal((await row(pg, taken)).deal_id, otherDeal);
    assert.equal((await dealRow(pg, d)).handed_off, true);
    assert.equal((await pg.query("select count(*)::int as c from installs")).rows[0].c, 5, "no install was made");
    const log = await one(pg, "select actor_name, detail from activity where entity_type = 'install' and entity_id = $1 order by id desc limit 1", [olderOpen]);
    assert.equal(log.actor_name, "rita");
    assert.match(log.detail, new RegExp(`linked to deal #${d} when it was marked complete; for an Admin to review`));
    // The card reads it.
    const today = todayChicago();
    assert.equal(api.mapInstall(await one(pg, "select * from installs where id = $1", [olderOpen]), today, weekBounds(today)).dealReview, "linked");
    assert.equal(api.mapInstall(await one(pg, "select * from installs where id = $1", [taken]), today, weekBounds(today)).dealReview, null);
  } finally {
    await pg.close();
  }
});

test("no open install with no deal: one is made for the deal, with its machines, for review", async () => {
  const { pg, sql } = await fresh();
  try {
    const finished = await install(pg, { complete: true, equip_status: "Installed" });
    const taken = await install(pg, { deal_id: await deal(pg) });
    const d = await deal(pg, { machines: BREWER, equipment: "Test Brewer TB-1" });
    await complete(sql, d);
    const mine = await installsOf(pg, d);
    assert.equal(mine.length, 1);
    assert.equal(mine[0].deal_review, "made");
    assert.ok(![finished, taken].includes(Number(mine[0].id)));
    const made = await one(pg, "select equipment, machines, deal_review_at from installs where id = $1", [mine[0].id]);
    assert.equal(made.equipment, "Test Brewer TB-1");
    assert.ok(made.deal_review_at);
    const uid = JSON.parse(made.machines)[0].uid;
    assert.ok(uid, "the machine is tied to the deal's row");
    assert.equal(JSON.parse((await one(pg, "select machines from deals where id = $1", [d])).machines)[0].uid, uid);
    assert.equal((await row(pg, finished)).deal_id, null, "the finished install isn't linked (the old rule linked the newest)");
    const log = await one(pg, "select detail from activity where entity_type = 'install' and entity_id = $1", [mine[0].id]);
    assert.match(log.detail, new RegExp(`made for deal #${d} when it was marked complete; for an Admin to review`));
  } finally {
    await pg.close();
  }
});

test("an install already tied to the deal isn't flagged; two deals of one account each get their own install", async () => {
  const { pg, sql } = await fresh();
  try {
    const d = await deal(pg);
    const onBoard = await install(pg, { deal_id: d });
    const open = await install(pg);
    await complete(sql, d);
    assert.deepEqual((await installsOf(pg, d)).map((r) => [Number(r.id), r.deal_review]), [[onBoard, null]]);
    assert.equal((await row(pg, open)).deal_id, null);
    const first = await deal(pg);
    const second = await deal(pg);
    await complete(sql, first);
    assert.equal((await row(pg, open)).deal_id, first);
    await complete(sql, second);
    const hers = await installsOf(pg, second);
    assert.equal(hers.length, 1);
    assert.equal(hers[0].deal_review, "made", "the open install is the first deal's now: one is made");
  } finally {
    await pg.close();
  }
});

test("a deal hands off on the save that completes it, not on each later save", async () => {
  const { pg, sql } = await fresh();
  try {
    const d = await deal(pg, { machines: BREWER });
    await complete(sql, d);
    const [made] = await installsOf(pg, d);
    // The install isn't needed: someone removes it. Saving the deal again doesn't make another.
    await pg.query("update installs set archived = true where id = $1", [made.id]);
    await api.updateDealFor(sql, { id: d, notes: "Paid in full" }, "u-rep");
    await api.updateDealFor(sql, { id: d, completion: "complete", invoice: "SO-4410" }, "u-rep");
    assert.equal((await installsOf(pg, d)).length, 0);
    assert.equal((await pg.query("select count(*)::int as c from installs where deal_id = $1", [d])).rows[0].c, 1);
    // Set back to open and completed again, it hands off again.
    await api.updateDealFor(sql, { id: d, completion: "open" }, "u-rep");
    await complete(sql, d);
    assert.equal((await installsOf(pg, d)).length, 1);
  } finally {
    await pg.close();
  }
});

test("Approve clears the review, for a linked install and a made one; only an Admin reviews", async () => {
  const { pg, sql } = await fresh();
  try {
    const open = await install(pg);
    const d1 = await deal(pg);
    await complete(sql, d1);
    const d2 = await deal(pg);
    await complete(sql, d2);
    const [made] = await installsOf(pg, d2);
    for (const user of ["u-rep", "u-tech", "u-nobody"]) {
      await assert.rejects(api.reviewDealLinkFor(sql, user, { installId: open, approve: true }), /Only an Admin can review a deal's link to an install\./);
    }
    await pg.query("update desk_accounts set approved = false where user_id = 'u-admin'");
    await assert.rejects(api.reviewDealLinkFor(sql, "u-admin", { installId: open, approve: true }), /Only an Admin/);
    await pg.query("update desk_accounts set approved = true where user_id = 'u-admin'");
    assert.deepEqual(await api.reviewDealLinkFor(sql, "u-admin", { installId: open, approve: true }), { approved: true, kind: "linked", dealId: d1, backOnHandoff: false });
    const r1 = await row(pg, open);
    assert.deepEqual([r1.deal_id, r1.deal_review, r1.deal_review_at], [d1, null, null]);
    assert.deepEqual(await api.reviewDealLinkFor(sql, "u-owner", { installId: Number(made.id), approve: true }), { approved: true, kind: "made", dealId: d2, backOnHandoff: false });
    assert.equal((await row(pg, made.id)).deal_review, null);
    await assert.rejects(api.reviewDealLinkFor(sql, "u-owner", { installId: open, approve: true }), /This install's deal link was already reviewed\./);
    await assert.rejects(api.reviewDealLinkFor(sql, "u-owner", { installId: open, approve: false }), /already reviewed/);
    await assert.rejects(api.reviewDealLinkFor(sql, "u-owner", { installId: 99999, approve: true }), /Install not found\./);
    const log = await one(pg, "select actor_name, detail from activity where entity_type = 'install' and entity_id = $1 order by id desc limit 1", [open]);
    assert.deepEqual([log.actor_name, log.detail], ["ada", `deal link approved: deal #${d1}`]);
  } finally {
    await pg.close();
  }
});

test("Unlink: the install keeps its work with no deal, the deal is back on the Handoff page, and its next handoff skips that install", async () => {
  const { pg, sql } = await fresh();
  try {
    const spare = await install(pg);
    const wrong = await install(pg, { notes: "Back door, call ahead", technician: "Tess" });
    const d = await deal(pg, { machines: BREWER });
    await complete(sql, d);
    assert.equal((await row(pg, wrong)).deal_id, d);
    assert.deepEqual(await api.reviewDealLinkFor(sql, "u-owner", { installId: wrong, approve: false }), { approved: false, kind: "linked", dealId: d, backOnHandoff: true });
    const after = await one(pg, "select deal_id, deal_review, deal_review_at, notes, technician, archived from installs where id = $1", [wrong]);
    assert.deepEqual(after, { deal_id: null, deal_review: null, deal_review_at: null, notes: "Back door, call ahead", technician: "Tess", archived: false });
    const back = await dealRow(pg, d);
    assert.equal(back.handed_off, false, "back on the Handoff page's completed deals");
    assert.deepEqual(back.unlinked_installs.map(Number), [wrong]);
    assert.match((await one(pg, "select detail from activity where entity_type = 'deal' and entity_id = $1 order by id desc limit 1", [d])).detail, new RegExp(`unlinked from install #${wrong}; back on the Handoff page`));
    // Saving the deal doesn't hand it off again: it waits for Send to installs.
    await api.updateDealFor(sql, { id: d, completion: "complete", notes: "Called the cafe" }, "u-rep");
    assert.equal((await dealRow(pg, d)).handed_off, false);
    assert.equal((await installsOf(pg, d)).length, 0);
    // Send to installs: the next open install, never the unlinked one.
    assert.deepEqual(await api.maybeHandoffInstall(sql, d, "u-rep"), { kind: "linked", installId: spare });
    assert.equal((await row(pg, spare)).deal_review, "linked");
    assert.equal((await row(pg, wrong)).deal_id, null);
    // Unlinked again, with no other open install: one is made, and the unlinked ones stay as they are.
    await api.reviewDealLinkFor(sql, "u-owner", { installId: spare, approve: false });
    assert.deepEqual((await dealRow(pg, d)).unlinked_installs.map(Number), [wrong, spare]);
    const made = await api.maybeHandoffInstall(sql, d, "u-rep");
    assert.equal(made.kind, "made");
    assert.ok(![wrong, spare].includes(made.installId));
    assert.equal((await row(pg, wrong)).deal_id, null);
    assert.equal((await row(pg, spare)).deal_id, null);
    // The deal is on its install now: the button says so.
    assert.deepEqual(await api.maybeHandoffInstall(sql, d, "u-rep"), { kind: "had", installId: made.installId });
  } finally {
    await pg.close();
  }
});

test("Unlink with another install still on the deal: the deal stays handed off", async () => {
  const { pg, sql } = await fresh();
  try {
    const open = await install(pg);
    const d = await deal(pg);
    await complete(sql, d);
    const board = await install(pg, { deal_id: d });
    assert.deepEqual(await api.reviewDealLinkFor(sql, "u-owner", { installId: open, approve: false }), { approved: false, kind: "linked", dealId: d, backOnHandoff: false });
    assert.equal((await dealRow(pg, d)).handed_off, true);
    assert.deepEqual((await installsOf(pg, d)).map((r) => Number(r.id)), [board]);
    assert.equal((await one(pg, "select detail from activity where entity_type = 'deal' and entity_id = $1 order by id desc limit 1", [d])).detail, `unlinked from install #${open}`);
    // A deal removed from the Pipeline meanwhile isn't "back on the Handoff page".
    const gone = await deal(pg, { customer: OTHER });
    const spare = await install(pg, { customer: OTHER });
    await complete(sql, gone);
    await pg.query("update deals set archived = true where id = $1", [gone]);
    assert.equal((await api.reviewDealLinkFor(sql, "u-owner", { installId: spare, approve: false })).backOnHandoff, false);
    assert.equal((await row(pg, spare)).deal_id, null);
  } finally {
    await pg.close();
  }
});

test("an install made for the deal isn't unlinked, and a linked one holding the deal's confirmed machines stays linked", async () => {
  const { pg, sql } = await fresh();
  try {
    const d = await deal(pg, { machines: BREWER });
    await complete(sql, d);
    const [made] = await installsOf(pg, d);
    await assert.rejects(
      api.reviewDealLinkFor(sql, "u-owner", { installId: Number(made.id), approve: false }),
      /This install was made for the deal, so it isn't unlinked: approve it, or remove it from the install list if it isn't needed\./,
    );
    assert.equal((await row(pg, made.id)).deal_review, "made");
    // A linked install the deal's machines were confirmed onto (on the Board) since the link.
    const open = await install(pg, { customer: OTHER });
    const d2 = await deal(pg, {
      customer: OTHER,
      machines: JSON.stringify([
        { equipment: "Test Grinder TG-2", serial: "", powerVoltage: "", ownership: "Sold", uid: "tie-g2", confirmedAt: "2026-11-03" },
        { equipment: "Test Brewer TB-1", serial: "", powerVoltage: "", ownership: "Sold" },
      ]),
    });
    await complete(sql, d2);
    assert.equal((await row(pg, open)).deal_review, "linked");
    const held = JSON.stringify([{ equipment: "Test Grinder TG-2", serial: "SN-G2", powerVoltage: "120", ownership: "Sold", uid: "tie-g2" }]);
    await pg.query("update installs set machines = $2, equipment = 'Test Grinder TG-2' where id = $1", [open, held]);
    await assert.rejects(
      api.reviewDealLinkFor(sql, "u-owner", { installId: open, approve: false }),
      /The deal's Test Grinder TG-2 was confirmed onto this install on the Board, so it stays linked\. Approve the link, or take it off this install first\./,
    );
    assert.equal((await row(pg, open)).deal_id, d2);
    // Another machine of its own (no tie to the deal) doesn't hold it.
    await pg.query("update installs set machines = $2 where id = $1", [open, JSON.stringify([{ equipment: "Test Grinder TG-2", serial: "SN-G2", powerVoltage: "120", uid: "own-1" }])]);
    assert.equal((await api.reviewDealLinkFor(sql, "u-owner", { installId: open, approve: false })).backOnHandoff, true);
  } finally {
    await pg.close();
  }
});

test("each write checks the link is as it was read: a review or a machine that raced in, and another deal taking the install", async () => {
  const { pg, sql } = await fresh();
  try {
    const open = await install(pg);
    const d = await deal(pg, { machines: JSON.stringify([{ equipment: "Test Brewer TB-1", serial: "", powerVoltage: "", ownership: "Sold", uid: "tie-b1", confirmedAt: "2026-11-03" }]) });
    await complete(sql, d);
    // Another Admin approves between the read and the write.
    const approved = racing(sql, /from installs where id = \$\d+ and archived = false/, () => pg.query("update installs set deal_review = null where id = $1", [open]));
    await assert.rejects(api.reviewDealLinkFor(approved, "u-owner", { installId: open, approve: true }), /This install's deal link changed meanwhile\. Open the Installs board again\./);
    await pg.query("update installs set deal_review = 'linked' where id = $1", [open]);
    // The deal's machine is confirmed onto it while the unlink checks: the write sees the install changed.
    const confirmed = racing(sql, /select machines from deals where id/, () =>
      pg.query("update installs set machines = $2 where id = $1", [open, JSON.stringify([{ equipment: "Test Brewer TB-1", serial: "", powerVoltage: "", uid: "tie-b1" }])]),
    );
    await assert.rejects(api.reviewDealLinkFor(confirmed, "u-owner", { installId: open, approve: false }), /changed meanwhile/);
    assert.equal((await row(pg, open)).deal_id, d);
    assert.equal((await dealRow(pg, d)).handed_off, true);
    // A handoff whose open install another deal takes first makes one instead.
    const spare = await install(pg, { customer: OTHER });
    const rival = await deal(pg, { customer: OTHER });
    const late = await deal(pg, { customer: OTHER });
    const raced = racing(sql, /deal_id is null and lower\(customer\) = \$1/, () => pg.query("update installs set deal_id = $2 where id = $1", [spare, rival]));
    const h = await api.maybeHandoffInstall(raced, late, "u-rep");
    assert.equal(h.kind, "made");
    assert.equal((await row(pg, spare)).deal_id, rival);
    assert.equal((await row(pg, h.installId)).deal_review, "made");
  } finally {
    await pg.close();
  }
});

test("the Handoff page's list: reviews waiting, newest first, with the sale; none for an approved, removed or archived-deal sale", async () => {
  const { pg, sql } = await fresh();
  try {
    const open = await install(pg, { wo: "WO-5501" });
    const d1 = await deal(pg, { invoice: " SO-801 ", po: "CUST-801", producer: "Rita" });
    await complete(sql, d1);
    const d2 = await deal(pg, { customer: OTHER, invoice: "SO-802", producer: "Mo" });
    await complete(sql, d2);
    const [made] = await installsOf(pg, d2);
    await pg.query("update installs set deal_review_at = now() + interval '1 minute' where id = $1", [made.id]);
    let list = await api.loadDealReviews(sql);
    assert.deepEqual(list.map((r) => [r.installId, r.dealId, r.kind]), [[Number(made.id), d2, "made"], [open, d1, "linked"]]);
    const linked = list[1];
    assert.deepEqual({ ...linked, at: typeof linked.at }, {
      installId: open,
      dealId: d1,
      customer: CAFE,
      wo: "WO-5501",
      status: "Not Ready",
      kind: "linked",
      at: "string",
      sale: { invoice: "SO-801", po: "CUST-801" },
      producer: "Rita",
    });
    // A deal removed from the Pipeline shows no sale numbers; an approved one, or one removed from the list, isn't listed.
    await pg.query("update deals set archived = true where id = $1", [d1]);
    list = await api.loadDealReviews(sql);
    assert.deepEqual(list.find((r) => r.installId === open).sale, { invoice: null, po: null });
    await api.reviewDealLinkFor(sql, "u-owner", { installId: open, approve: true });
    await pg.query("update installs set archived = true where id = $1", [made.id]);
    assert.deepEqual(await api.loadDealReviews(sql), []);
    // A handoff of a deal removed from the Pipeline does nothing.
    assert.equal(await api.maybeHandoffInstall(sql, d1, "u-rep"), null);
  } finally {
    await pg.close();
  }
});

test("0114 adds the review columns, and running it twice is safe", async () => {
  const pg = new PGlite();
  try {
    for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
    await pg.exec(readFileSync(new URL("0114_deal_link_review.sql", MIGRATIONS), "utf8"));
    const cols = (await pg.query(
      "select table_name, column_name, data_type, column_default from information_schema.columns where (table_name, column_name) in (('installs','deal_review'),('installs','deal_review_at'),('deals','unlinked_installs')) order by 1, 2",
    )).rows;
    assert.deepEqual(cols.map((c) => [c.table_name, c.column_name, c.data_type]), [
      ["deals", "unlinked_installs", "ARRAY"],
      ["installs", "deal_review", "text"],
      ["installs", "deal_review_at", "timestamp with time zone"],
    ]);
    const d = Number((await one(pg, "insert into deals (customer) values ('Test Cafe') returning id")).id);
    assert.deepEqual((await one(pg, "select unlinked_installs from deals where id = $1", [d])).unlinked_installs, []);
    assert.equal((await one(pg, "insert into installs (customer) values ('Test Cafe') returning deal_review")).deal_review, null);
  } finally {
    await pg.close();
  }
});

test("the screens: the card's review, the Handoff page's list, the buttons, and the save that hands off", () => {
  const installs = src("src/routes/_app/installs.tsx");
  assert.match(installs, /\{i\.dealReview \? <DealLinkReview installId=\{i\.id\} kind=\{i\.dealReview\} className="mt-1 sm:pl-20" \/> : null\}/);
  assert.match(installs, /import \{ DealLinkReview \} from "@\/components\/desk\/deal-link-review";/);
  const handoff = src("src/routes/_app/handoff.tsx");
  assert.match(handoff, /<h2 className="font-display text-xl">Deal Links To Review<\/h2>/);
  assert.match(handoff, /filtered\.dealReviews\.map\(\(r\) =>/);
  assert.match(handoff, /<DealLinkReview installId=\{r\.installId\} kind=\{r\.kind\} badge=\{false\} \/>/);
  assert.match(handoff, /dealReviews: reviewer \? reviews : reviews\.filter\(\(r\) => namesMatchUser\(asUser, r\.producer\)\)/);
  assert.match(handoff, /const reviewer = !!access\.data\?\.approved && \(!!access\.data\.isAdmin \|\| access\.data\.role === "admin"\);/);
  assert.match(handoff, /mine\.pendingHandoffs\.length \+\s+mine\.dealReviews\.length \+/);
  assert.match(handoff, /!filtered\.pendingHandoffs\.length &&\s+!filtered\.dealReviews\.length &&/);
  assert.match(handoff, /toast\.success\(handoffToast\(r\.handoff\)\)/);
  assert.match(handoff, /const empty: HandoffFeed = \{ asks: \[\], recent: \[\], pendingHandoffs: \[\], dealReviews: \[\] \};/);
  const review = src("src/components/desk/deal-link-review.tsx");
  assert.match(review, /const canReview = !!me\.data\?\.approved && \(!!me\.data\.isAdmin \|\| me\.data\.role === "admin"\);/);
  assert.match(review, /\{kind === "linked" \? \(\s+<Button/);
  assert.match(review, /if \(window\.confirm\(DEAL_UNLINK_CONFIRM\)\) review\.mutate\(false\);/);
  assert.match(review, /review\.mutate\(true\);/);
  assert.match(review, /\["installs", "handoff", "customer-history", "deals", "dashboard"\]/);
  assert.match(review, /title=\{dealReviewText\(kind\)\}/);
  const server = src("src/lib/ops/api.ts");
  assert.match(server, /if \(completion === "complete" && c\.completion !== "complete"\) await maybeHandoffInstall\(sql, data\.id, userId\);/);
  assert.match(server, /return \{ ok: true, handoff: await maybeHandoffInstall\(await ready\(\), data\.dealId, context\.userId\) \};/);
  assert.match(server, /dealReviews: await loadDealReviews\(sql\)/);
  assert.match(server, /\.validator\(\(d: \{ installId: number; approve: boolean \}\) => z\.object\(\{ installId: z\.number\(\)\.int\(\), approve: z\.boolean\(\) \}\)\.parse\(d\)\)/);
});
