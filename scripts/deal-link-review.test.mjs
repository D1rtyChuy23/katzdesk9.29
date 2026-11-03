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
const F = await import("../src/lib/ops/handoff-filter.ts");
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
/** The same handle, with `action` run once right after the nth query (the first by default) whose text matches `when`. */
function racing(sql, when, action, nth = 1) {
  let seen = 0;
  return wrap(async (text, params) => {
    const rows = await sql.query(text, params);
    if (when.test(text) && ++seen === nth) await action();
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
  assert.match(R.dealReviewText("made"), /no open install with no deal\. An Admin approves it\. If it's the same job as another install on the account, merge it into that one \(Details, Merge into install\); if the deal needs no install, remove it\.$/);
  assert.match(R.DEAL_UNLINK_CONFIRM, /keeps its own work\. The deal goes back to the Handoff page's completed deals, and its next handoff won't pick this install again\.$/);
  assert.equal(R.DEAL_MADE_NO_UNLINK, "This install was made for the deal, so it isn't unlinked: approve it, merge it into the account's install for the same job, or remove it if the deal needs no install.");
  // Approve for an Admin; Unlink only for a linked install; nothing for anyone else.
  assert.deepEqual(R.dealReviewButtons("linked", true), { approve: true, unlink: true });
  assert.deepEqual(R.dealReviewButtons("made", true), { approve: true, unlink: false });
  assert.deepEqual(R.dealReviewButtons("linked", false), { approve: false, unlink: false });
  assert.deepEqual(R.dealReviewButtons("made", false), { approve: false, unlink: false });
  assert.equal(R.dealReviewToast({ approved: true, kind: "linked", backOnHandoff: false }), "Deal link approved");
  assert.equal(R.dealReviewToast({ approved: true, kind: "made", backOnHandoff: false }), "Install approved for its deal");
  assert.equal(R.dealReviewToast({ approved: false, kind: "linked", backOnHandoff: true }), "Unlinked. The deal is back on the Handoff page's completed deals, under All.");
  assert.equal(R.dealReviewToast({ approved: false, kind: "linked", backOnHandoff: false }), "Unlinked.");
  assert.equal(R.handoffToast({ kind: "linked", installId: 4 }), "Linked to the account's open install, for an Admin to review.");
  assert.equal(R.handoffToast({ kind: "made", installId: 4 }), "Install made for the deal, for an Admin to review.");
  assert.equal(R.handoffToast({ kind: "had", installId: 4 }), "That deal was sent to installs already.");
  assert.equal(R.handoffToast({ kind: "had", installId: null }), "That deal was sent to installs already.");
  assert.equal(R.handoffToast({ kind: "open", installId: null }), "That deal isn't complete anymore.");
  assert.equal(R.handoffToast(null), "That deal isn't on the Pipeline anymore.");
});

test("the Handoff page's Mine: an Admin's has every deal link to review, anyone else's none (they're under All)", () => {
  const ask = (id, f = {}) => ({ id, authorId: null, authorName: null, technician: null, producer: null, accountRep: null, status: null, ...f });
  const review = (installId, producer) => ({ installId, dealId: installId + 100, customer: "Test Cafe", wo: null, status: "Not Ready", kind: "linked", at: null, sale: { invoice: null, po: null }, producer });
  const feed = {
    asks: [ask(1, { producer: "Rita" }), ask(2, { producer: "Mo" })],
    recent: [ask(1, { producer: "Rita" }), ask(3, { authorId: "u-rita" })],
    pendingHandoffs: [{ dealId: 9, customer: "Test Cafe", equipment: null, producer: "Rita" }, { dealId: 8, customer: "Test Bakery", equipment: null, producer: "Mo" }],
    dealReviews: [review(5, "Rita"), review(6, "Mo")],
  };
  const rita = { id: "u-rita", displayName: "Rita Test", primaryEmail: "rita@example.test" };
  const all = F.filterHandoff(feed, rita, "rita", "all", false);
  assert.deepEqual(all.dealReviews.map((r) => r.installId), [5, 6]);
  assert.equal(all.pendingHandoffs.length, 2);
  const repMine = F.filterHandoff(feed, rita, "rita", "mine", false);
  assert.deepEqual(repMine.dealReviews, [], "a rep's own deal's link waits for an Admin: under All only");
  assert.deepEqual(repMine.pendingHandoffs.map((p) => p.dealId), [9]);
  assert.deepEqual(repMine.asks.map((c) => c.id), [1]);
  assert.deepEqual(repMine.recent.map((c) => c.id), [1, 3]);
  assert.equal(F.handoffMineCount(repMine), 1 + 0 + 1 + 1, "the note that's also an open ask counts once");
  const adminMine = F.filterHandoff(feed, rita, "rita", "mine", true);
  assert.deepEqual(adminMine.dealReviews.map((r) => r.installId), [5, 6], "an Admin's Mine has every one, whoever's deal");
  assert.deepEqual(adminMine.pendingHandoffs.map((p) => p.dealId), [9]);
  assert.equal(F.handoffMineCount(adminMine), 1 + 2 + 1 + 1);
  // Nothing loaded yet; a feed from before the reviews (no dealReviews) reads as none.
  assert.deepEqual(F.filterHandoff(undefined, rita, "rita", "mine", true), { asks: [], recent: [], pendingHandoffs: [], dealReviews: [] });
  const older = { ...feed, dealReviews: undefined };
  assert.deepEqual(F.filterHandoff(older, rita, "rita", "all", true).dealReviews, []);
  assert.deepEqual(F.filterHandoff(older, rita, "rita", "mine", true).dealReviews, []);
});

test("marked complete, a deal takes the account's newest open install with no deal, for review; never a finished one", async () => {
  const { pg, sql } = await fresh();
  try {
    const olderOpen = await install(pg);
    const otherDeal = await deal(pg);
    const taken = await install(pg, { deal_id: otherDeal });
    const finished = await install(pg, { complete: true, equip_status: "Installed" });
    const statusOnly = await install(pg, { equip_status: "Installed" });
    const flagOnly = await install(pg, { complete: true, equip_status: "Not Ready" });
    const elsewhere = await install(pg, { customer: OTHER });
    const d = await deal(pg, { customer: "  test roastery - MIDTOWN " });
    await complete(sql, d);
    const linked = await row(pg, olderOpen);
    assert.equal(linked.deal_id, d, "the newest open install with no deal: not a finished one, not another deal's");
    assert.equal(linked.deal_review, "linked");
    assert.ok(linked.deal_review_at, "with the time it was linked");
    for (const id of [finished, statusOnly, flagOnly, elsewhere]) assert.equal((await row(pg, id)).deal_id, null, `install #${id} keeps no deal`);
    assert.equal((await row(pg, taken)).deal_id, otherDeal);
    assert.equal((await dealRow(pg, d)).handed_off, true);
    assert.equal((await pg.query("select count(*)::int as c from installs")).rows[0].c, 6, "no install was made");
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

test("a save that read the deal before a handoff tied its rows doesn't untie them", async () => {
  const { pg, sql } = await fresh();
  try {
    // The deal waits on the Handoff page; someone presses Send to installs while the rep's window saves its rows.
    const d = await deal(pg, { completion: "complete", machines: BREWER });
    let made = null;
    const sendMeanwhile = racing(sql, /^select \* from deals where id = \$\d+$/, async () => {
      made = await api.maybeHandoffInstall(sql, d, "u-owner");
    });
    // The window adds a grinder; it read the brewer before the handoff tied it.
    const windowRows = [
      { equipment: "Test Brewer TB-1", serial: "", powerVoltage: "120", ownership: "Sold" },
      { equipment: "Test Grinder TG-2", serial: "", powerVoltage: "", ownership: "Sold" },
    ];
    await api.updateDealFor(sendMeanwhile, { id: d, machines: windowRows, notes: "Grinder added" }, "u-rep");
    assert.equal(made.kind, "made");
    const installUid = JSON.parse((await one(pg, "select machines from installs where id = $1", [made.installId])).machines)[0].uid;
    const rows = JSON.parse((await one(pg, "select machines, notes from deals where id = $1", [d])).machines);
    assert.deepEqual(rows.map((m) => [m.equipment, m.uid ?? null]), [["Test Brewer TB-1", installUid], ["Test Grinder TG-2", null]], "the brewer tied again, the grinder added");
    // A save with no rows (notes, say) read before the tie leaves the stored rows as they are.
    const d2 = await deal(pg, { customer: OTHER, completion: "complete", machines: BREWER });
    let made2 = null;
    const sendMeanwhile2 = racing(sql, /^select \* from deals where id = \$\d+$/, async () => {
      made2 = await api.maybeHandoffInstall(sql, d2, "u-owner");
    });
    await api.updateDealFor(sendMeanwhile2, { id: d2, notes: "Called" }, "u-rep");
    const uid2 = JSON.parse((await one(pg, "select machines from installs where id = $1", [made2.installId])).machines)[0].uid;
    assert.equal(JSON.parse((await one(pg, "select machines from deals where id = $1", [d2])).machines)[0].uid, uid2);
    assert.equal((await one(pg, "select notes from deals where id = $1", [d2])).notes, "Called");
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
    // One removed from the list while its review waited isn't reviewed.
    const d3 = await deal(pg, { customer: OTHER });
    await complete(sql, d3);
    const [gone] = await installsOf(pg, d3);
    await pg.query("update installs set archived = true where id = $1", [gone.id]);
    for (const approve of [true, false]) await assert.rejects(api.reviewDealLinkFor(sql, "u-owner", { installId: Number(gone.id), approve }), /Install not found\./);
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
    // Nor one that fell through, or was set back to open: the page lists completed deals only.
    for (const status of ["fell", "open"]) {
      const d4 = await deal(pg, { customer: OTHER });
      const i4 = await install(pg, { customer: OTHER });
      await complete(sql, d4);
      assert.equal((await row(pg, i4)).deal_id, d4);
      await api.updateDealFor(sql, { id: d4, completion: status }, "u-rep");
      const r = await api.reviewDealLinkFor(sql, "u-owner", { installId: i4, approve: false });
      assert.equal(r.backOnHandoff, false, status);
      assert.match((await one(pg, "select detail from activity where entity_type = 'deal' and entity_id = $1 order by id desc limit 1", [d4])).detail, new RegExp(`^unlinked from install #${i4}$`));
    }
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
      /This install was made for the deal, so it isn't unlinked: approve it, merge it into the account's install for the same job, or remove it if the deal needs no install\./,
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
    // Another Admin approves while the unlink checks: the approval stands.
    await pg.query("update installs set machines = null where id = $1", [open]);
    const approvedFirst = racing(sql, /select machines from deals where id/, () => pg.query("update installs set deal_review = null, deal_review_at = null where id = $1", [open]));
    await assert.rejects(api.reviewDealLinkFor(approvedFirst, "u-owner", { installId: open, approve: false }), /changed meanwhile/);
    assert.deepEqual([(await row(pg, open)).deal_id, (await row(pg, open)).deal_review], [d, null]);
    assert.equal((await dealRow(pg, d)).handed_off, true);
    // A handoff whose open install another deal takes first takes the next one, else makes one.
    const OPEN_INSTALLS = /select id, customer from installs\s+where archived = false and deal_id is null/;
    const older = await install(pg, { customer: OTHER });
    const spare = await install(pg, { customer: OTHER });
    const rival = await deal(pg, { customer: OTHER });
    const late = await deal(pg, { customer: OTHER, completion: "complete" });
    const first = racing(sql, OPEN_INSTALLS, () => pg.query("update installs set deal_id = $2 where id = $1", [spare, rival]));
    assert.deepEqual(await api.maybeHandoffInstall(first, late, "u-rep"), { kind: "linked", installId: older });
    assert.equal((await row(pg, spare)).deal_id, rival);
    const last = await deal(pg, { customer: OTHER, completion: "complete" });
    const loose = await install(pg, { customer: OTHER });
    const second = racing(sql, OPEN_INSTALLS, () => pg.query("update installs set deal_id = $2 where id = $1", [loose, rival]));
    const h = await api.maybeHandoffInstall(second, last, "u-rep");
    assert.equal(h.kind, "made");
    assert.equal((await row(pg, h.installId)).deal_review, "made");
    // One finished meanwhile isn't linked either, nor one removed from the list.
    const next = await deal(pg, { customer: OTHER, completion: "complete" });
    const closing = await install(pg, { customer: OTHER });
    const done = racing(sql, OPEN_INSTALLS, () => pg.query("update installs set complete = true where id = $1", [closing]));
    assert.equal((await api.maybeHandoffInstall(done, next, "u-rep")).kind, "made");
    assert.equal((await row(pg, closing)).deal_id, null);
    const after = await deal(pg, { customer: OTHER, completion: "complete" });
    const dropped = await install(pg, { customer: OTHER });
    const removed = racing(sql, OPEN_INSTALLS, () => pg.query("update installs set archived = true where id = $1", [dropped]));
    assert.equal((await api.maybeHandoffInstall(removed, after, "u-rep")).kind, "made");
    assert.equal((await row(pg, dropped)).deal_id, null);
  } finally {
    await pg.close();
  }
});

test("the same account by the rule install merges use: spacing, punctuation and Inc don't matter; another location or a walk-in never links", async () => {
  const { pg, sql } = await fresh();
  try {
    const spaced = await install(pg, { customer: " Test Roastery  Midtown " });
    await install(pg, { customer: "Test Roastery - Midtown Annex" });
    const d = await deal(pg, { customer: "Test Roastery - Midtown, Inc." });
    await complete(sql, d);
    assert.equal((await row(pg, spaced)).deal_id, d, "the same core words: the same account");
    assert.equal((await installsOf(pg, d)).length, 1);
    // A deal saved with stray spaces finds its account's install too.
    const bakery = await install(pg, { customer: "Test Bakery - Eastside" });
    const d2 = await deal(pg, { customer: "  Test Bakery -  Eastside " });
    await complete(sql, d2);
    assert.equal((await row(pg, bakery)).deal_id, d2);
    // Walk-in names are many customers: never linked.
    const walkIn = await install(pg, { customer: "Walk-In" });
    const d3 = await deal(pg, { customer: "Walk-In" });
    await complete(sql, d3);
    assert.equal((await row(pg, walkIn)).deal_id, null);
    assert.equal((await installsOf(pg, d3))[0].deal_review, "made");
  } finally {
    await pg.close();
  }
});

test("one deal, one handoff: two saves completing it at once, two presses of Send to installs, or the Board first", async () => {
  const { pg, sql } = await fresh();
  try {
    // Two saves that complete the deal at once (Save, and the Invoice button's save): one hands it off.
    const open = await install(pg);
    const d = await deal(pg);
    await Promise.all([complete(sql, d), complete(sql, d)]);
    assert.deepEqual((await installsOf(pg, d)).map((r) => [Number(r.id), r.deal_review]), [[open, "linked"]]);
    // A save that read the deal before another save completed it: the write finds it complete, and doesn't hand off.
    const d2 = await deal(pg, { customer: OTHER, machines: BREWER });
    const behind = racing(sql, /select \* from deals where id = \$\d+$/, () => complete(sql, d2));
    await complete(behind, d2);
    assert.equal((await installsOf(pg, d2)).length, 1);
    // A save completing the deal again while someone presses Send to installs on a page from before: one handoff.
    const d6 = await deal(pg, { customer: "Test Cart", completion: "complete" });
    await api.updateDealFor(sql, { id: d6, completion: "open" }, "u-rep");
    const both = await Promise.all([complete(sql, d6), api.maybeHandoffInstall(sql, d6, "u-owner")]);
    assert.equal((await installsOf(pg, d6)).length, 1);
    assert.equal((await dealRow(pg, d6)).handed_off, true);
    assert.ok(both[1] && ["had", "made", "open"].includes(both[1].kind));
    // Send to installs from an old page, on a deal set back to open: nothing is handed off, and it says why.
    const d7 = await deal(pg, { customer: "Test Booth", completion: "complete" });
    await api.updateDealFor(sql, { id: d7, completion: "open" }, "u-rep");
    assert.deepEqual(await api.maybeHandoffInstall(sql, d7, "u-owner"), { kind: "open", installId: null });
    assert.equal((await dealRow(pg, d7)).handed_off, false);
    assert.equal((await installsOf(pg, d7)).length, 0);
    // Completed again, it hands off once.
    await complete(sql, d7);
    assert.equal((await installsOf(pg, d7)).length, 1);
    // The rep saves the deal (a grinder added) while its handoff runs: the install is made from the deal as saved, both
    // rows are tied, and the save isn't written over.
    const d9 = await deal(pg, { customer: "Test Van", completion: "complete", machines: BREWER });
    const grinderAdded = racing(sql, /select id, customer from installs\s+where archived = false and deal_id is null/, () =>
      pg.query("update deals set machines = $2 where id = $1", [d9, JSON.stringify([...JSON.parse(BREWER), { equipment: "Test Grinder TG-2", serial: "", powerVoltage: "", ownership: "Sold" }])]),
    );
    const h9 = await api.maybeHandoffInstall(grinderAdded, d9, "u-owner");
    assert.equal(h9.kind, "made");
    assert.deepEqual(JSON.parse((await one(pg, "select machines from installs where id = $1", [h9.installId])).machines).map((m) => m.equipment), ["Test Brewer TB-1", "Test Grinder TG-2"]);
    const d9rows = JSON.parse((await one(pg, "select machines from deals where id = $1", [d9])).machines);
    assert.deepEqual(d9rows.map((m) => [m.equipment, !!m.uid]), [["Test Brewer TB-1", true], ["Test Grinder TG-2", true]]);
    // A handoff that fails while another handoff of the deal holds the claim (the deal was set back to open and completed
    // again meanwhile) leaves that claim alone.
    const d10 = await deal(pg, { customer: "Test Wagon", completion: "complete" });
    await install(pg, { customer: "Test Wagon" });
    const otherClaim = wrap(async (text, params) => {
      if (/update installs set deal_id = /.test(text)) {
        await pg.query("update deals set handed_off = true, handoff_claim = 'another-handoff' where id = $1", [d10]);
        throw new Error("made-up failure");
      }
      return sql.query(text, params);
    });
    await assert.rejects(api.maybeHandoffInstall(otherClaim, d10, "u-owner"), /made-up failure/);
    assert.deepEqual(
      [(await dealRow(pg, d10)).handed_off, (await one(pg, "select handoff_claim from deals where id = $1", [d10])).handoff_claim],
      [true, "another-handoff"],
      "the other handoff's claim stands",
    );
    // Two handoffs past their claims at once (the deal set back to open and completed again during the first): only the
    // later one, which has the claim, makes the install, even for a deal with no machine rows.
    const d11 = await deal(pg, { customer: "Test Mobile", completion: "complete" });
    const reclaimed = racing(sql, /select id, customer from installs\s+where archived = false and deal_id is null/, async () => {
      await api.updateDealFor(sql, { id: d11, completion: "open" }, "u-rep");
      await complete(sql, d11);
    });
    const h11 = await api.maybeHandoffInstall(reclaimed, d11, "u-owner");
    assert.equal(h11.kind, "had", "the first handoff lost its claim");
    assert.equal((await installsOf(pg, d11)).length, 1);
    assert.equal(h11.installId, Number((await installsOf(pg, d11))[0].id));
    // The deal kept changing while its install was made: the handoff stops, says so, and the deal is back on the Handoff page.
    const d12 = await deal(pg, { customer: "Test Cart 2", completion: "complete", machines: BREWER });
    let edits = 0;
    const churning = wrap(async (text, params) => {
      if (/with d as \(\s*select id from deals/.test(text) && /insert into installs/.test(text)) {
        await pg.query("update deals set machines = $2 where id = $1", [d12, JSON.stringify([{ equipment: "Test Brewer TB-1", serial: `S-${++edits}`, powerVoltage: "", ownership: "Sold" }])]);
      }
      return sql.query(text, params);
    });
    await assert.rejects(api.maybeHandoffInstall(churning, d12, "u-owner"), /The deal kept changing while its install was made\. Send it to installs again from the Handoff page\./);
    assert.deepEqual([(await dealRow(pg, d12)).handed_off, (await installsOf(pg, d12)).length], [false, 0]);
    // A handoff that fails before its install is made puts the deal back on the Handoff page.
    const d8 = await deal(pg, { customer: "Test Truck" });
    const broken = wrap(async (text, params) => {
      if (/insert into installs/.test(text)) throw new Error("made-up failure");
      return sql.query(text, params);
    });
    await assert.rejects(complete(broken, d8), /made-up failure/);
    assert.deepEqual([(await dealRow(pg, d8)).handed_off, (await installsOf(pg, d8)).length], [false, 0]);
    assert.equal((await api.maybeHandoffInstall(sql, d8, "u-owner")).kind, "made");
    // Two presses of Send to installs at once: one sends it, the other says it was sent.
    const d3 = await deal(pg, { customer: "Test Diner", completion: "complete" });
    const results = await Promise.all([api.maybeHandoffInstall(sql, d3, "u-rep"), api.maybeHandoffInstall(sql, d3, "u-owner")]);
    assert.deepEqual(results.map((r) => r.kind).sort(), ["had", "made"]);
    assert.equal((await installsOf(pg, d3)).length, 1);
    // The same deal took the open install between the read and the link (another handoff of it): no second install,
    // and the account's other open install isn't linked to it as well.
    const shopOther = await install(pg, { customer: "Test Shop" });
    const shop = await install(pg, { customer: "Test Shop" });
    const d4 = await deal(pg, { customer: "Test Shop", completion: "complete" });
    const same = racing(sql, /select id, customer from installs\s+where archived = false and deal_id is null/, () => pg.query("update installs set deal_id = $2 where id = $1", [shop, d4]));
    assert.deepEqual(await api.maybeHandoffInstall(same, d4, "u-rep"), { kind: "had", installId: shop });
    assert.deepEqual((await installsOf(pg, d4)).map((r) => Number(r.id)), [shop]);
    assert.equal((await row(pg, shopOther)).deal_id, null);
    // The Board made the deal's install just before one would be made: none is made, and the deal's rows aren't tied.
    const d5 = await deal(pg, { customer: "Test Kiosk", machines: BREWER, completion: "complete" });
    let board = null;
    const boardFirst = racing(sql, /select id, customer from installs\s+where archived = false and deal_id is null/, async () => {
      board = await insertRow(pg, "installs", { customer: "Test Kiosk", deal_id: d5, equip_status: "Not Ready" });
    });
    assert.deepEqual(await api.maybeHandoffInstall(boardFirst, d5, "u-rep"), { kind: "had", installId: board });
    assert.equal((await installsOf(pg, d5)).length, 1);
    assert.equal(JSON.parse((await one(pg, "select machines from deals where id = $1", [d5])).machines)[0].uid, undefined);
  } finally {
    await pg.close();
  }
});

test("Unlink clears the deal's copy of a pulled unit's serial, as a return to the barn does; the unit stays with the install", async () => {
  const { pg, sql } = await fresh();
  try {
    const open = await install(pg);
    const d = await deal(pg, { machines: JSON.stringify([{ equipment: "Bunn TB3", serial: "", powerVoltage: "120", ownership: "Sold" }]) });
    await complete(sql, d);
    assert.equal((await row(pg, open)).deal_review, "linked");
    const unit = Number((await one(pg, "insert into assets (kind, model, serial, qty, site, pallet, level, line_no, status) values ('equip', 'Bunn TB3', 'TB-77', 1, 'barn-back', 'A', 1, 1, 'ready') returning id")).id);
    await api.assignAssetToInstallFor(sql, { assetId: unit, installId: open }, { userId: "u-owner" });
    const dealSerial = async (id) => JSON.parse((await one(pg, "select machines from deals where id = $1", [id])).machines).map((m) => m.serial);
    assert.deepEqual(await dealSerial(d), ["TB-77"], "the pull wrote the serial onto the deal");
    // Marked sold at the install (it can't go back to the barn then): Unlink still works.
    await pg.query("update assets set status = 'sold', locked_by = 'System (sold)' where id = $1", [unit]);
    assert.equal((await api.reviewDealLinkFor(sql, "u-owner", { installId: open, approve: false })).backOnHandoff, true);
    assert.deepEqual(await dealSerial(d), [""], "the deal's copy is cleared");
    assert.match((await one(pg, "select detail from activity where entity_type = 'deal' and entity_id = $1 order by id desc limit 1", [d])).detail, new RegExp(`^unlinked from install #${open}; back on the Handoff page; serial TB-77 cleared from its machines \\(the unit stays with install #${open}\\)$`));
    const kept = await one(pg, "select install_id, status, serial from assets where id = $1", [unit]);
    assert.deepEqual(kept, { install_id: open, status: "sold", serial: "TB-77" }, "the unit stays with the install");
    assert.match((await one(pg, "select machines from installs where id = $1", [open])).machines, /TB-77/);
    // Sent to installs again, the new install doesn't carry the serial.
    const h = await api.maybeHandoffInstall(sql, d, "u-rep");
    assert.equal(h.kind, "made");
    assert.doesNotMatch(String((await one(pg, "select machines from installs where id = $1", [h.installId])).machines), /TB-77/);
    // The serial typed on the deal's row another way (case, spaces) is the same serial: cleared too.
    const typed = await install(pg, { customer: "Test Shop" });
    const d3 = await deal(pg, { customer: "Test Shop", machines: JSON.stringify([{ equipment: "Bunn TB3", serial: " tb-88", powerVoltage: "120", ownership: "Sold" }]) });
    await complete(sql, d3);
    const unit2 = Number((await one(pg, "insert into assets (kind, model, serial, qty, site, pallet, level, line_no, status) values ('equip', 'Bunn TB3', 'TB-88', 1, 'barn-back', 'A', 1, 2, 'ready') returning id")).id);
    await api.assignAssetToInstallFor(sql, { assetId: unit2, installId: typed }, { userId: "u-owner" });
    await api.reviewDealLinkFor(sql, "u-owner", { installId: typed, approve: false });
    assert.deepEqual(await dealSerial(d3), [""]);
    // A unit of another model with the same serial isn't the deal's machine: its row keeps the serial.
    const kiosk = await install(pg, { customer: "Test Kiosk" });
    const d4 = await deal(pg, { customer: "Test Kiosk", machines: JSON.stringify([{ equipment: "Test Brewer TB-1", serial: "1001", powerVoltage: "", ownership: "Sold" }]) });
    await complete(sql, d4);
    await pg.query("insert into assets (kind, model, serial, qty, site, status, install_id) values ('equip', 'Test Grinder TG-2', '1001', 1, 'field', 'assigned', $1)", [kiosk]);
    await api.reviewDealLinkFor(sql, "u-owner", { installId: kiosk, approve: false });
    assert.deepEqual(await dealSerial(d4), ["1001"]);
    // A unit of the deal's model already at the install before the link, with the serial the rep typed: the unit is the
    // install's, so the deal's copy is cleared too (its next install mustn't carry a unit that's at this one).
    const booth = await install(pg, { customer: "Test Booth B" });
    await pg.query("insert into assets (kind, model, serial, qty, site, status, install_id) values ('equip', 'Bunn TB3', 'TB-55', 1, 'field', 'assigned', $1)", [booth]);
    const d5 = await deal(pg, { customer: "Test Booth B", machines: JSON.stringify([{ equipment: "Bunn TB3", serial: "TB-55", powerVoltage: "", ownership: "Sold" }]) });
    await complete(sql, d5);
    await api.reviewDealLinkFor(sql, "u-owner", { installId: booth, approve: false });
    assert.deepEqual(await dealSerial(d5), [""]);
    // The deal saved between Unlink's read of its machines and its write: the write is tried again on the saved rows.
    const stall = await install(pg, { customer: "Test Stall" });
    const d6 = await deal(pg, { customer: "Test Stall", machines: JSON.stringify([{ equipment: "Bunn TB3", serial: "", powerVoltage: "", ownership: "Sold" }, { equipment: "Test Grinder TG-2", serial: "", powerVoltage: "", ownership: "Sold" }]) });
    await complete(sql, d6);
    const unit3 = Number((await one(pg, "insert into assets (kind, model, serial, qty, site, pallet, level, line_no, status) values ('equip', 'Bunn TB3', 'TB-99', 1, 'barn-back', 'A', 1, 3, 'ready') returning id")).id);
    await api.assignAssetToInstallFor(sql, { assetId: unit3, installId: stall }, { userId: "u-owner" });
    assert.deepEqual(await dealSerial(d6), ["TB-99", ""]);
    const savedMeanwhile = racing(sql, /select machines from deals where id/, async () => {
      const rows = JSON.parse((await one(pg, "select machines from deals where id = $1", [d6])).machines);
      rows[1].serial = "TG-TYPED";
      await pg.query("update deals set machines = $2 where id = $1", [d6, JSON.stringify(rows)]);
    }, 2);
    await api.reviewDealLinkFor(savedMeanwhile, "u-owner", { installId: stall, approve: false });
    assert.deepEqual(await dealSerial(d6), ["", "TG-TYPED"], "the serial cleared, and the save meanwhile kept");
    // Saved again before every try: the serial stays, and the deal's activity says to check its machines.
    const stall2 = await install(pg, { customer: "Test Stall 2" });
    const d7 = await deal(pg, { customer: "Test Stall 2", machines: JSON.stringify([{ equipment: "Bunn TB3", serial: "", powerVoltage: "", ownership: "Sold" }]) });
    await complete(sql, d7);
    const unit4 = Number((await one(pg, "insert into assets (kind, model, serial, qty, site, pallet, level, line_no, status) values ('equip', 'Bunn TB3', 'TB-44', 1, 'barn-back', 'A', 1, 4, 'ready') returning id")).id);
    await api.assignAssetToInstallFor(sql, { assetId: unit4, installId: stall2 }, { userId: "u-owner" });
    let reads = 0;
    const busy = wrap(async (text, params) => {
      const rows = await sql.query(text, params);
      if (/^select machines from deals where id/.test(text) && ++reads > 1) await pg.query("update deals set notes = $2, machines = machines || ' ' where id = $1", [d7, `save ${reads}`]);
      return rows;
    });
    await api.reviewDealLinkFor(busy, "u-owner", { installId: stall2, approve: false });
    assert.deepEqual((await dealSerial(d7)).map((v) => v.trim()), ["TB-44"]);
    assert.match((await one(pg, "select detail from activity where entity_type = 'deal' and entity_id = $1 order by id desc limit 1", [d7])).detail, /; check its machines: the serials of install #\d+'s units couldn't be cleared \(the deal was being saved\)$/);
    // A unit on the install whose serial isn't on the deal leaves the deal's rows as they are.
    const other = await install(pg, { customer: OTHER });
    const d2 = await deal(pg, { customer: OTHER, machines: JSON.stringify([{ equipment: "Test Brewer TB-1", serial: "TB1-9", powerVoltage: "", ownership: "Sold" }]) });
    await complete(sql, d2);
    await pg.query("insert into assets (kind, model, serial, qty, site, status, install_id) values ('equip', 'Test Grinder TG-2', 'TG-5', 1, 'field', 'assigned', $1)", [other]);
    assert.equal((await api.reviewDealLinkFor(sql, "u-owner", { installId: other, approve: false })).approved, false);
    assert.deepEqual(await dealSerial(d2), ["TB1-9"]);
  } finally {
    await pg.close();
  }
});

test("a made install merged into the account's install for the same job: the kept one takes the deal and its machine's tie", async () => {
  const { pg, sql } = await fresh();
  try {
    const finished = await install(pg, { complete: true, equip_status: "Installed", equipment: "Test Brewer TB-1", machines: JSON.stringify([{ equipment: "Test Brewer TB-1", serial: "SN-1", powerVoltage: "120" }]) });
    const d = await deal(pg, { machines: BREWER });
    await complete(sql, d);
    const [made] = await installsOf(pg, d);
    assert.equal(made.deal_review, "made");
    const { mergeInstallsFor } = await import("../src/lib/ops/install-projects.ts");
    await mergeInstallsFor(sql, "u-owner", { keepId: finished, dropId: Number(made.id) });
    const keeper = await one(pg, "select deal_id, machines from installs where id = $1", [finished]);
    assert.equal(keeper.deal_id, d);
    const uid = JSON.parse((await one(pg, "select machines from deals where id = $1", [d])).machines)[0].uid;
    const rows = JSON.parse(keeper.machines);
    assert.equal(rows.length, 1, "one brewer, not two");
    assert.deepEqual([rows[0].serial, rows[0].uid, rows[0].ownership], ["SN-1", uid, "Sold"], "the kept row takes the tie and Sold/Loan/Lease");
    // Two rows tied to two different deal rows are two machines, even of one model with no serials.
    const { mergedMachineList } = await import("../src/lib/ops/install-projects.ts");
    const spec = (uid) => ({ equipment: "Test Brewer TB-1", serial: "", powerVoltage: "", ...(uid ? { uid } : {}) });
    assert.deepEqual(mergedMachineList([spec("u-1")], [spec("u-2")]).list.map((m) => m.uid), ["u-1", "u-2"]);
    assert.deepEqual(mergedMachineList([spec("u-1")], [spec("u-1")]).list.map((m) => m.uid), ["u-1"]);
    assert.deepEqual(mergedMachineList([spec(null)], [spec("u-2")]).list.map((m) => m.uid), ["u-2"]);
    assert.deepEqual(mergedMachineList([spec("u-1")], [spec(null)]).list.map((m) => m.uid), ["u-1"]);
    // The same serial is the same machine, whatever the ties; the same tie folds into its own row first.
    const sn = (serial, uid) => ({ equipment: "Test Brewer TB-1", serial, powerVoltage: "", ...(uid ? { uid } : {}) });
    assert.deepEqual(mergedMachineList([sn("S-1", "u-1")], [sn("S-1", "u-2")]).list.map((m) => [m.serial, m.uid]), [["S-1", "u-1"]]);
    assert.deepEqual(mergedMachineList([sn("", null), sn("", "u-1")], [sn("", "u-1")]).list.map((m) => m.uid ?? null), [null, "u-1"]);
    // Each kind of match is tried for every dropped row first: a row with no serial doesn't take the row another serial
    // matches, and the same machine twice on the dropped install is added once.
    assert.deepEqual(mergedMachineList([sn("S-A", null), sn("", null)], [sn("", "U1"), sn("S-A", "U2")]).list.map((m) => [m.serial, m.uid ?? null]), [["S-A", "U2"], ["", "U1"]]);
    assert.deepEqual(mergedMachineList([sn("", null)], [sn("S-9", "U"), sn("S-9", "U")]).list.map((m) => [m.serial, m.uid]), [["S-9", "U"]]);
    assert.deepEqual(mergedMachineList([sn("S-1", null)], [sn("S-2", null), sn("S-2", null)]).list.map((m) => m.serial), ["S-1", "S-2"]);
    // The kept row's other blanks come from the dropped row; what it has stays.
    const kept = { equipment: "Test Brewer TB-1", serial: "SN-1", powerVoltage: "", plug: "5-15", ownership: "Leased" };
    const dropped = { equipment: "Test Brewer TB-1", serial: "", powerVoltage: "120", uid: "u-9", ownership: "Sold", plug: "5-20", water: "Line", recipeId: 7 };
    const [m] = mergedMachineList([kept], [dropped]).list;
    assert.deepEqual(
      [m.serial, m.powerVoltage, m.uid, m.ownership, m.plug, m.water, m.recipeId],
      ["SN-1", "120", "u-9", "Leased", "5-15", "Line", 7],
    );
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
  assert.match(handoff, /import \{ filterHandoff, handoffMineCount, type HandoffScope \} from "@\/lib\/ops\/handoff-filter";/);
  assert.doesNotMatch(handoff, /function filterHandoff/, "the page uses the tested filter, not a copy");
  assert.match(handoff, /<h2 className="font-display text-xl">Deal Links To Review<\/h2>/);
  assert.match(handoff, /\{filtered\.dealReviews\.length \? \(/);
  assert.match(handoff, /filtered\.dealReviews\.map\(\(r\) =>/);
  assert.match(handoff, /<DealLinkReview installId=\{r\.installId\} kind=\{r\.kind\} badge=\{false\} \/>/);
  assert.match(handoff, /const reviewer = !!access\.data\?\.approved && \(!!access\.data\.isAdmin \|\| access\.data\.role === "admin"\);/);
  assert.match(handoff, /filterHandoff\(d, user, access\.data\?\.username \?\? null, scope, reviewer\)/);
  assert.match(handoff, /handoffMineCount\(filterHandoff\(d, user, access\.data\?\.username \?\? null, "mine", reviewer\)\)/);
  assert.match(handoff, /!filtered\.pendingHandoffs\.length &&\s+!filtered\.dealReviews\.length &&/);
  assert.match(handoff, /toast\.success\(handoffToast\(r\.handoff\)\)/);
  const review = src("src/components/desk/deal-link-review.tsx");
  assert.match(review, /const canReview = !!me\.data\?\.approved && \(!!me\.data\.isAdmin \|\| me\.data\.role === "admin"\);\s+const buttons = dealReviewButtons\(kind, canReview\);/);
  assert.match(review, /\{buttons\.approve \? \(/);
  assert.match(review, /\{buttons\.unlink \? \(\s+<Button/);
  assert.match(review, /if \(window\.confirm\(DEAL_UNLINK_CONFIRM\)\) review\.mutate\(false\);/);
  assert.match(review, /review\.mutate\(true\);/);
  assert.match(review, /\["installs", "handoff", "customer-history", "deals", "dashboard"\]/);
  assert.match(review, /title=\{dealReviewText\(kind\)\}/);
  // On a phone (no hover), a tap on the badge shows its text.
  assert.match(review, /aria-expanded=\{why\}/);
  assert.match(review, /\{badge && why \? \(\s+<span className="basis-full text-xs text-muted-foreground" data-testid="deal-review-text">\s+\{dealReviewText\(kind\)\}/);
  const server = src("src/lib/ops/api.ts");
  // Guards whose effect needs two connections (real Postgres), which PGlite doesn't have: pinned here instead. The row lock
  // on the deal's status read, and the handoff claiming the deal (it runs only while the deal isn't handed off; the save
  // that completes a deal puts it in line).
  assert.match(server, /update deals set handed_off = true, handoff_claim = \$\{claim\}, updated_at = now\(\)\s+where id = \$\{dealId\} and archived = false and not handed_off and completion = 'complete'\s+returning \*/);
  assert.match(server, /with d as \(select id from deals where id = \$\{dealId\}::int and handoff_claim = \$\{claim\}::text for update\)/);
  assert.match(server, /where id = \$\{dealId\} and handoff_claim = \$\{claim\}\s+and not exists/);
  assert.match(server, /with prev as \(select id, completion, machines from deals where id = \$\{data\.id\} for update\)/);
  assert.match(server, /where deals\.id = prev\.id and \(not \$\{sendsMachines\}::boolean or prev\.machines is not distinct from \$\{c\.machines \?\? null\}::text\)/);
  assert.match(server, /if \(now\.completion !== "complete"\) return \{ kind: "open", installId: null \};/);
  // The install made in one statement that locks the deal and checks its machines are as read.
  assert.match(server, /select id from deals\s+where id = \$\{dealId\}::int and archived = false and handoff_claim = \$\{claim\}::text\s+and machines is not distinct from \$\{cur\.machines \?\? null\}::text\s+for update/);
  assert.match(server, /handed_off = case when \$\{completion === "complete"\}::boolean and prev\.completion is distinct from 'complete' then false else deals\.handed_off end,/);
  assert.match(server, /if \(completion === "complete" && wrote\[0\] && wrote\[0\]\.was !== "complete"\) await maybeHandoffInstall\(sql, data\.id, userId\);/);
  assert.match(server, /return \{ ok: true, handoff: await maybeHandoffInstall\(await ready\(\), data\.dealId, context\.userId\) \};/);
  assert.match(server, /dealReviews: await loadDealReviews\(sql\)/);
  assert.match(server, /\.validator\(\(d: \{ installId: number; approve: boolean \}\) => z\.object\(\{ installId: z\.number\(\)\.int\(\), approve: z\.boolean\(\) \}\)\.parse\(d\)\)/);
});
