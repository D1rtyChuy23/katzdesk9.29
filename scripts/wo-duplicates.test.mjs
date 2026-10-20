import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
const { attachHeldReview, mergeMoneyRefusal, mergeServiceJobs, mergeTicketsSql, reconcileServiceDuplicates, tryMergeServiceDuplicate } = await import(
  "../src/lib/ops/wo-duplicates.ts"
);

async function applyMigrations(pg) {
  const dir = new URL("../migrations/", import.meta.url);
  const names = readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();
  for (const name of names) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
}

const pg = new PGlite();
await applyMigrations(pg);
const sql = { query: async (text, params) => (await pg.query(text, params)).rows };

let seq = 0;

async function ticket(fields = {}) {
  seq += 1;
  const row = await pg.query(
    `insert into service_jobs (kind, call_id, customer, wo, status, completed_at, po, ns_so, discount_kind, discount_value)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     returning id`,
    [
      fields.kind ?? "service",
      fields.callId ?? `SC-M-${seq}`,
      fields.customer ?? "Cafe",
      fields.wo ?? null,
      fields.status ?? "Open",
      fields.completed ?? "2026-04-01",
      fields.po ?? null,
      fields.nsSo ?? null,
      fields.discountKind ?? null,
      fields.discountValue ?? null,
    ],
  );
  return Number(row.rows[0].id);
}

async function line(jobId, sort, item) {
  await pg.query(
    "insert into ticket_charges (job_id, item, qty, rate, kind, sort) values ($1, $2, 1, 10, 'part', $3)",
    [jobId, item, sort],
  );
}

async function chargeSorts(jobId) {
  const rows = await pg.query("select item, sort from ticket_charges where job_id = $1 order by sort, id", [jobId]);
  return rows.rows.map((row) => ({ item: row.item, sort: Number(row.sort) }));
}

function money(over = {}) {
  return {
    id: 1,
    nsSo: null,
    lines: 0,
    hasQuote: false,
    discountKind: null,
    discountValue: null,
    ...over,
  };
}

test("a keeper's line and the extra's two lines become sorts 1, 2, 3 and stay on the billing export", async () => {
  const keeper = await ticket({ kind: "service", customer: "North Cafe", wo: "WO-4101", status: "Completed" });
  const extra = await ticket({ kind: "tlc", customer: "North Cafe", wo: "WO-4101", callId: "SC-EXTRA-4101", status: "Open" });
  await line(keeper, 1, "Trip");
  await line(extra, 1, "Labor");
  await line(extra, 2, "Seal");
  await pg.query("insert into comments (entity_type, entity_id, body) values ('tlc', $1, 'from the extra')", [extra]);
  await pg.query("insert into activity (entity_type, entity_id, action, detail) values ('tlc', $1, 'updated', 'before')", [extra]);
  await pg.query("insert into desk_notifications (user_id, body, entity_type, entity_id) values ('u', 'ping', 'tlc', $1)", [extra]);
  await pg.query("insert into assets (kind, model, site, job_id) values ('equip', 'E4', 'shop', $1)", [extra]);

  const result = await mergeServiceJobs(sql, keeper, extra, "Chuy");
  assert.deepEqual(result, { keeperId: keeper, extraId: extra });
  assert.deepEqual(await chargeSorts(keeper), [
    { item: "Trip", sort: 1 },
    { item: "Labor", sort: 2 },
    { item: "Seal", sort: 3 },
  ]);
  assert.deepEqual(await chargeSorts(extra), []);
  const marked = await pg.query("select duplicate_of, status from service_jobs where id = $1", [extra]);
  assert.equal(Number(marked.rows[0].duplicate_of), keeper);
  const keeperStatus = await pg.query("select status from service_jobs where id = $1", [keeper]);
  assert.equal(keeperStatus.rows[0].status, "Completed");

  const exported = await pg.query(
    `select j.id, c.item
       from service_jobs j
       join ticket_charges c on c.job_id = j.id
       left join directory_customers dc on dc.archived = false and lower(btrim(dc.name)) = lower(btrim(j.customer))
      where j.duplicate_of is null
        and j.completed_at between $1::date and $2::date
        and j.ns_so is null
        and j.id = $3
      order by j.completed_at, j.id, c.sort, c.id`,
    ["2026-04-01", "2026-04-30", keeper],
  );
  assert.deepEqual(
    exported.rows.map((row) => row.item),
    ["Trip", "Labor", "Seal"],
  );

  const comment = await pg.query("select entity_type, entity_id from comments where body = 'from the extra'");
  assert.equal(comment.rows[0].entity_type, "service");
  assert.equal(Number(comment.rows[0].entity_id), keeper);
  const moved = await pg.query("select entity_type, entity_id from activity where detail = 'before'");
  assert.equal(Number(moved.rows[0].entity_id), keeper);
  const ping = await pg.query("select entity_id from desk_notifications where body = 'ping'");
  assert.equal(Number(ping.rows[0].entity_id), keeper);
  const asset = await pg.query("select job_id from assets where model = 'E4'");
  assert.equal(Number(asset.rows[0].job_id), keeper);
  const detail = await pg.query("select detail from activity where action = 'merged' and entity_id = $1", [keeper]);
  assert.match(detail.rows[0].detail, new RegExp(`Merged #${extra} \\(SC-EXTRA-4101\\) into this ticket · WO-4101 · moved 2 charge lines`));
});

test("a billed keeper with the extra's lines is refused and nothing moves", async () => {
  const keeper = await ticket({ wo: "wo 4102", customer: "Walk-in", nsSo: "SO100" });
  const extra = await ticket({ wo: "WO-4102", customer: "North Cafe", po: "PO-7" });
  await line(keeper, 1, "Keep");
  await line(extra, 1, "Extra");
  await pg.query("insert into comments (entity_type, entity_id, body) values ('service', $1, 'stay put')", [extra]);
  const result = await mergeServiceJobs(sql, keeper, extra, "Chuy");
  assert.deepEqual(result, { refused: `Ticket #${keeper} is billed on SO100. Clear its Sales Order before merging charges into it.` });
  assert.deepEqual(await chargeSorts(extra), [{ item: "Extra", sort: 1 }]);
  const dup = await pg.query("select duplicate_of from service_jobs where id = $1", [extra]);
  assert.equal(dup.rows[0].duplicate_of, null);
  const comment = await pg.query("select entity_id from comments where body = 'stay put'");
  assert.equal(Number(comment.rows[0].entity_id), extra);
  const kept = await pg.query("select customer, wo, po from service_jobs where id = $1", [keeper]);
  assert.equal(kept.rows[0].customer, "Walk-in");
  assert.equal(kept.rows[0].wo, "wo 4102");
  assert.equal(kept.rows[0].po, null);
});

test("an extra that is already billed is refused", async () => {
  const keeper = await ticket({ wo: "WO-4103" });
  const extra = await ticket({ wo: "WO-4103", nsSo: "SO200" });
  await line(extra, 1, "Billed");
  const result = await mergeServiceJobs(sql, keeper, extra, "Chuy");
  assert.deepEqual(result, { refused: `Ticket #${extra} is billed on SO200. Merge the other ticket into it instead.` });
  assert.equal((await chargeSorts(extra)).length, 1);
});

test("two repair quotes are refused; the extra's quote and rebuild move when the keeper has none", async () => {
  const bothKeeper = await ticket({ wo: "WO-4104" });
  const bothExtra = await ticket({ wo: "WO-4104" });
  await pg.query("insert into repair_quotes (job_id) values ($1), ($2)", [bothKeeper, bothExtra]);
  const both = await mergeServiceJobs(sql, bothKeeper, bothExtra, "Chuy");
  assert.deepEqual(both, { refused: "Both tickets have a repair quote. Combine them by hand first." });
  const still = await pg.query("select job_id from repair_quotes where job_id = any($1::int[]) order by job_id", [[bothKeeper, bothExtra]]);
  assert.deepEqual(still.rows.map((row) => Number(row.job_id)), [bothKeeper, bothExtra]);

  const keeper = await ticket({ kind: "service", customer: "North Cafe", wo: "WO-4105" });
  const extra = await ticket({ kind: "tlc", customer: "North Cafe", wo: "WO-4105" });
  const quote = await pg.query("insert into repair_quotes (job_id) values ($1) returning id", [extra]);
  const rebuild = await pg.query("insert into rebuilds (title, account, job_id) values ('Head', 'North Cafe', $1) returning id", [extra]);
  const result = await mergeServiceJobs(sql, keeper, extra, "Chuy");
  assert.deepEqual(result, { keeperId: keeper, extraId: extra });
  const movedQuote = await pg.query("select job_id from repair_quotes where id = $1", [quote.rows[0].id]);
  assert.equal(Number(movedQuote.rows[0].job_id), keeper);
  const movedRebuild = await pg.query("select job_id from rebuilds where id = $1", [rebuild.rows[0].id]);
  assert.equal(Number(movedRebuild.rows[0].job_id), keeper);
  const detail = await pg.query("select detail from activity where action = 'merged' and entity_id = $1", [keeper]);
  assert.match(detail.rows[0].detail, /moved 0 charge lines and the repair quote/);
});

test("the statement itself writes nothing when the keeper was billed after the check", async () => {
  const keeper = await ticket({ wo: "WO-4106", nsSo: "SO300" });
  const extra = await ticket({ wo: "WO-4106" });
  await line(extra, 1, "Race");
  const stamps = await pg.query("select id, updated_at::text as updated from service_jobs where id = any($1::int[])", [[keeper, extra]]);
  const ku = stamps.rows.find((row) => Number(row.id) === keeper).updated;
  const eu = stamps.rows.find((row) => Number(row.id) === extra).updated;
  const rows = await pg.query(mergeTicketsSql(), [
    keeper,
    extra,
    "Chuy",
    "Cafe",
    null,
    null,
    null,
    null,
    null,
    null,
    "WO-4106",
    null,
    null,
    "2026-04-01",
    null,
    null,
    "Normal",
    ku,
    eu,
  ]);
  assert.equal(rows.rows.length, 0);
  assert.deepEqual(await chargeSorts(extra), [{ item: "Race", sort: 1 }]);
  assert.deepEqual(await chargeSorts(keeper), []);
  const dup = await pg.query("select duplicate_of from service_jobs where id = $1", [extra]);
  assert.equal(dup.rows[0].duplicate_of, null);
  const noted = await pg.query("select count(*)::int as n from activity where action = 'merged' and entity_id = $1", [keeper]);
  assert.equal(Number(noted.rows[0].n), 0);
});

test("two invoice rows keep the keeper's approval; a TLC-only invoice follows the keeper", async () => {
  const keeper = await ticket({ kind: "service", customer: "North Cafe", wo: "WO-4107" });
  const extra = await ticket({ kind: "tlc", customer: "South Cafe", wo: "WO-4108" });
  await pg.query(
    `insert into invoices (entity_type, entity_id, customer, total, approved_by, approved_at)
     values ('service', $1, 'North Cafe', 10, 'Chuy', '2026-04-02T15:00:00Z'),
            ('tlc', $2, 'South Cafe', 20, 'Sam', '2026-04-03T15:00:00Z')`,
    [keeper, extra],
  );
  assert.deepEqual(await mergeServiceJobs(sql, keeper, extra, "Chuy"), { keeperId: keeper, extraId: extra });
  const left = await pg.query(
    "select entity_type, entity_id, customer, approved_by from invoices where entity_id = any($1::int[]) order by entity_id",
    [[keeper, extra]],
  );
  assert.deepEqual(left.rows, [{ entity_type: "service", entity_id: keeper, customer: "North Cafe", approved_by: "Chuy" }]);

  const keeper2 = await ticket({ kind: "service", customer: "North Cafe", wo: "WO-4109" });
  const extra2 = await ticket({ kind: "tlc", customer: "South Cafe", wo: "WO-4110" });
  await pg.query(
    `insert into invoices (entity_type, entity_id, customer, total, approved_by, approved_at)
     values ('tlc', $1, 'South Cafe', 30, 'Sam', '2026-04-04T15:00:00Z')`,
    [extra2],
  );
  assert.deepEqual(await mergeServiceJobs(sql, keeper2, extra2, "Chuy"), { keeperId: keeper2, extraId: extra2 });
  const moved = await pg.query("select entity_type, entity_id, customer, approved_by from invoices where entity_id = $1", [keeper2]);
  assert.deepEqual(moved.rows, [{ entity_type: "service", entity_id: keeper2, customer: "North Cafe", approved_by: "Sam" }]);
  const gone = await pg.query("select count(*)::int as n from invoices where entity_id = $1 and entity_type = 'tlc'", [extra2]);
  assert.equal(Number(gone.rows[0].n), 0);
});

test("the extra's discount moves onto an empty keeper, and is refused when the keeper already has lines", async () => {
  const empty = await ticket({ wo: "WO-4111" });
  const discounted = await ticket({ wo: "WO-4111", discountKind: "percent", discountValue: 10 });
  await line(discounted, 1, "Part");
  assert.deepEqual(await mergeServiceJobs(sql, empty, discounted, "Chuy"), { keeperId: empty, extraId: discounted });
  const saved = await pg.query("select discount_kind, discount_value from service_jobs where id = $1", [empty]);
  assert.equal(saved.rows[0].discount_kind, "percent");
  assert.equal(Number(saved.rows[0].discount_value), 10);

  const keeper = await ticket({ wo: "WO-4112" });
  const extra = await ticket({ wo: "WO-4112", discountKind: "percent", discountValue: 10 });
  await line(keeper, 1, "Keep");
  await line(extra, 1, "Extra");
  const refused = await mergeServiceJobs(sql, keeper, extra, "Chuy");
  assert.deepEqual(refused, {
    refused: `Ticket #${extra} has a 10% discount that ticket #${keeper} doesn't. Make the discounts match first.`,
  });
  const keeperDiscount = await pg.query("select discount_kind from service_jobs where id = $1", [keeper]);
  assert.equal(keeperDiscount.rows[0].discount_kind, null);
  assert.equal((await chargeSorts(extra)).length, 1);
});

test("the extra's P.O. fills a blank keeper P.O. and leaves the keeper's own P.O. in place", async () => {
  const blank = await ticket({ wo: "WO-4113", po: "   " });
  const filler = await ticket({ wo: "WO-4113", po: "PO-9" });
  assert.deepEqual(await mergeServiceJobs(sql, blank, filler, "Chuy"), { keeperId: blank, extraId: filler });
  const filled = await pg.query("select po from service_jobs where id = $1", [blank]);
  assert.equal(filled.rows[0].po, "PO-9");

  const keeper = await ticket({ wo: "WO-4114", po: "PO-1" });
  const extra = await ticket({ wo: "WO-4114", po: "PO-2" });
  assert.deepEqual(await mergeServiceJobs(sql, keeper, extra, "Chuy"), { keeperId: keeper, extraId: extra });
  const kept = await pg.query("select po from service_jobs where id = $1", [keeper]);
  assert.equal(kept.rows[0].po, "PO-1");
  const detail = await pg.query("select detail from activity where action = 'merged' and entity_id = $1", [keeper]);
  assert.match(detail.rows[0].detail, /extra P\.O\. PO-2/);
});

test("an older merge into the extra follows the keeper, and merging again changes nothing", async () => {
  const keeper = await ticket({ wo: "WO-4115" });
  const extra = await ticket({ wo: "WO-4115" });
  const older = await ticket({ wo: "WO-4116" });
  await pg.query("update service_jobs set duplicate_of = $2 where id = $1", [older, extra]);
  await line(extra, 1, "Once");
  assert.deepEqual(await mergeServiceJobs(sql, keeper, extra, "Chuy"), { keeperId: keeper, extraId: extra });
  assert.deepEqual(await chargeSorts(keeper), [{ item: "Once", sort: 1 }]);
  const pointed = await pg.query("select duplicate_of from service_jobs where id = $1", [older]);
  assert.equal(Number(pointed.rows[0].duplicate_of), keeper);
  const before = await pg.query("select item, sort, job_id from ticket_charges where job_id = $1", [keeper]);
  const notes = await pg.query("select count(*)::int as n from activity where action = 'merged' and entity_id = $1", [keeper]);
  const again = await mergeServiceJobs(sql, keeper, extra, "Chuy");
  assert.deepEqual(again, { keeperId: keeper, extraId: extra });
  const after = await pg.query("select item, sort, job_id from ticket_charges where job_id = $1", [keeper]);
  assert.deepEqual(after.rows, before.rows);
  const notesAfter = await pg.query("select count(*)::int as n from activity where action = 'merged' and entity_id = $1", [keeper]);
  assert.equal(Number(notesAfter.rows[0].n), Number(notes.rows[0].n));
  const still = await pg.query("select duplicate_of from service_jobs where id = any($1::int[]) order by id", [[extra, older]]);
  assert.deepEqual(still.rows.map((row) => Number(row.duplicate_of)), [keeper, keeper]);
});

test("Corrigo holds a billed extra, and the reconcile lists that hold", async () => {
  const wo = "WO-4117";
  const keeper = await ticket({ wo, customer: "Cafe" });
  const extra = await ticket({ wo, customer: "Cafe", nsSo: "SO400" });
  await line(extra, 1, "Held");
  const outcome = await tryMergeServiceDuplicate(sql, keeper, extra, "Chuy");
  assert.deepEqual(outcome, {
    result: "held",
    reason: `Ticket #${extra} is billed on SO400. Merge the other ticket into it instead.`,
    keeperId: keeper,
    extraId: extra,
  });
  const recon = await reconcileServiceDuplicates(sql, "Chuy");
  assert.ok(recon.held.some((held) => held.keeperId === keeper && held.extraId === extra && held.reason === outcome.reason));
  assert.equal((await pg.query("select duplicate_of from service_jobs where id = $1", [extra])).rows[0].duplicate_of, null);
});

test("a merged ticket takes no new charges", async () => {
  process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
  const { writeTicketCharges } = await import("../src/lib/ops/charges-api.ts");
  const keeper = await ticket({ wo: "WO-4118" });
  const extra = await ticket({ wo: "WO-4119" });
  await pg.query("update service_jobs set duplicate_of = $2 where id = $1", [extra, keeper]);
  await assert.rejects(
    () => writeTicketCharges(sql, extra, "user", { lines: [{ item: "Seal", description: "", qty: 1, rate: 10 }] }),
    (err) => err instanceof Error && err.message === `This ticket was merged into #${keeper}. Add charges there.`,
  );
  assert.equal((await chargeSorts(extra)).length, 0);
});

test("mergeMoneyRefusal names the first reason, in order", () => {
  assert.equal(
    mergeMoneyRefusal(money({ id: 1, nsSo: "SO1", lines: 1 }), money({ id: 2, nsSo: "SO2", lines: 1, hasQuote: true })),
    "Ticket #2 is billed on SO2. Merge the other ticket into it instead.",
  );
  assert.equal(
    mergeMoneyRefusal(money({ id: 7, nsSo: "SO7" }), money({ id: 8, lines: 2 })),
    "Ticket #7 is billed on SO7. Clear its Sales Order before merging charges into it.",
  );
  assert.equal(mergeMoneyRefusal(money({ id: 7, nsSo: "SO7" }), money({ id: 8, lines: 0 })), null);
  assert.equal(
    mergeMoneyRefusal(money({ id: 1, hasQuote: true }), money({ id: 2, hasQuote: true })),
    "Both tickets have a repair quote. Combine them by hand first.",
  );
  assert.equal(mergeMoneyRefusal(money({ id: 1 }), money({ id: 2, hasQuote: true })), null);
  assert.equal(
    mergeMoneyRefusal(money({ id: 3, lines: 1 }), money({ id: 4, lines: 1, discountKind: "percent", discountValue: 10 })),
    "Ticket #4 has a 10% discount that ticket #3 doesn't. Make the discounts match first.",
  );
  assert.equal(
    mergeMoneyRefusal(
      money({ id: 3, discountKind: "amount", discountValue: 10 }),
      money({ id: 4, lines: 1, discountKind: "amount", discountValue: 50 }),
    ),
    "Ticket #3 has a $10.00 discount and ticket #4 has $50.00; merged, only one would apply. Make the discounts match first.",
  );
  assert.equal(
    mergeMoneyRefusal(
      money({ id: 3, lines: 1, discountKind: "percent", discountValue: 10 }),
      money({ id: 4, lines: 1, discountKind: "percent", discountValue: 10 }),
    ),
    null,
  );
  assert.equal(
    mergeMoneyRefusal(money({ id: 3 }), money({ id: 4, lines: 2, discountKind: "percent", discountValue: 10 })),
    null,
  );
  assert.equal(
    mergeMoneyRefusal(money({ id: 1, lines: 100 }), money({ id: 2, lines: 101 })),
    "Together these tickets would have more than 200 charge lines.",
  );
  assert.equal(mergeMoneyRefusal(money({ id: 1, lines: 100 }), money({ id: 2, lines: 100 })), null);
  assert.equal(
    mergeMoneyRefusal(money({ id: 1, lines: 150 }), money({ id: 2, lines: 150, discountKind: "percent", discountValue: 10 })),
    "Ticket #2 has a 10% discount that ticket #1 doesn't. Make the discounts match first.",
  );
  assert.equal(
    mergeMoneyRefusal(
      money({ id: 1, lines: 1, completedAt: "2026-04-01" }),
      money({ id: 2, lines: 1, completedAt: "2026-04-08" }),
    ),
    "Ticket #2 was completed 2026-04-08 and #1 2026-04-01, so charges would bill in a different week. Make the completed dates match first.",
  );
  assert.equal(
    mergeMoneyRefusal(
      money({ id: 1, lines: 150, completedAt: "2026-04-01", discountKind: "percent", discountValue: 10 }),
      money({ id: 2, lines: 150, completedAt: "2026-04-08" }),
    ),
    "Ticket #1 has a 10% discount that ticket #2 doesn't. Make the discounts match first.",
  );
  assert.equal(
    mergeMoneyRefusal(
      money({ id: 1, lines: 150, completedAt: "2026-04-01" }),
      money({ id: 2, lines: 150, completedAt: "2026-04-08" }),
    ),
    "Ticket #2 was completed 2026-04-08 and #1 2026-04-01, so charges would bill in a different week. Make the completed dates match first.",
  );
});

test("zero rows from the statement re-reads the reason, or says the tickets changed", async () => {
  function dup(id) {
    return {
      id,
      kind: "service",
      call_id: `SC-${id}`,
      customer: "Cafe",
      contact: null,
      phone: null,
      equipment: null,
      issue: null,
      call_type: null,
      technician: null,
      wo: "WO-1",
      status: "Open",
      notes: null,
      work_done: null,
      completed_at: null,
      scheduled: null,
      received: null,
      urgency: "Normal",
      done: false,
      duplicate_of: null,
    };
  }
  function scripted(moneyRows) {
    let reads = 0;
    return {
      query: async (text, params) => {
        if (text.includes("as has_quote")) {
          reads += 1;
          return moneyRows(reads);
        }
        if (text.includes("Merged #")) return [];
        return [dup(Number(params[0]))];
      },
    };
  }
  const raced = await mergeServiceJobs(
    scripted(() => [
      { id: 1, ns_so: null, po: null, discount_kind: null, discount_value: null, lines: 0, has_quote: false },
      { id: 2, ns_so: null, po: null, discount_kind: null, discount_value: null, lines: 0, has_quote: false },
    ]),
    1,
    2,
    "Chuy",
  );
  assert.deepEqual(raced, { refused: "Those tickets changed while merging. Try again." });

  const billed = await mergeServiceJobs(
    scripted((read) => [
      { id: 1, ns_so: null, po: null, discount_kind: null, discount_value: null, lines: 0, has_quote: false },
      { id: 2, ns_so: read === 1 ? null : "SO9", po: null, discount_kind: null, discount_value: null, lines: 1, has_quote: false },
    ]),
    1,
    2,
    "Chuy",
  );
  assert.deepEqual(billed, { refused: "Ticket #2 is billed on SO9. Merge the other ticket into it instead." });
});

test("a keeper's percent does not spread onto the extra's undiscounted lines", async () => {
  const keeper = await ticket({ wo: "WO-4201", discountKind: "percent", discountValue: 10 });
  const extra = await ticket({ wo: "WO-4201" });
  await line(keeper, 1, "Keep");
  await line(extra, 1, "Extra");
  const result = await mergeServiceJobs(sql, keeper, extra, "Chuy");
  assert.deepEqual(result, {
    refused: `Ticket #${keeper} has a 10% discount that ticket #${extra} doesn't. Make the discounts match first.`,
  });
  assert.deepEqual(await chargeSorts(extra), [{ item: "Extra", sort: 1 }]);
});

test("a discount mismatch is refused whichever ticket is kept", async () => {
  const discounted = await ticket({ wo: "WO-4202", discountKind: "percent", discountValue: 10 });
  const plain = await ticket({ wo: "WO-4202" });
  await line(discounted, 1, "Disc");
  await line(plain, 1, "Plain");
  const one = await mergeServiceJobs(sql, discounted, plain, "Chuy");
  const other = await mergeServiceJobs(sql, plain, discounted, "Chuy");
  assert.deepEqual(one, {
    refused: `Ticket #${discounted} has a 10% discount that ticket #${plain} doesn't. Make the discounts match first.`,
  });
  assert.deepEqual(other, {
    refused: `Ticket #${discounted} has a 10% discount that ticket #${plain} doesn't. Make the discounts match first.`,
  });
  assert.equal((await chargeSorts(discounted)).length, 1);
  assert.equal((await chargeSorts(plain)).length, 1);
});

test("two amount discounts are refused because only one would apply", async () => {
  const keeper = await ticket({ wo: "WO-4203", discountKind: "amount", discountValue: 50 });
  const extra = await ticket({ wo: "WO-4203", discountKind: "amount", discountValue: 50 });
  await line(keeper, 1, "Keep");
  await line(extra, 1, "Extra");
  const result = await mergeServiceJobs(sql, keeper, extra, "Chuy");
  assert.deepEqual(result, {
    refused: `Ticket #${keeper} has a $50.00 discount and ticket #${extra} has $50.00; merged, only one would apply. Make the discounts match first.`,
  });
  assert.equal((await chargeSorts(keeper)).length, 1);
});

test("an extra with a discount and no lines does not hand the discount over", async () => {
  const keeper = await ticket({ wo: "WO-4204" });
  const extra = await ticket({ wo: "WO-4204", discountKind: "percent", discountValue: 10 });
  assert.deepEqual(await mergeServiceJobs(sql, keeper, extra, "Chuy"), { keeperId: keeper, extraId: extra });
  const saved = await pg.query("select discount_kind, discount_value from service_jobs where id = $1", [keeper]);
  assert.equal(saved.rows[0].discount_kind, null);
  assert.equal(saved.rows[0].discount_value, null);
});

test("charges are not merged onto a different completed date", async () => {
  const keeper = await ticket({ wo: "WO-4205", completed: "2026-04-01" });
  const extra = await ticket({ wo: "WO-4205", completed: "2026-04-08" });
  await line(extra, 1, "Jump");
  const result = await mergeServiceJobs(sql, keeper, extra, "Chuy");
  assert.deepEqual(result, {
    refused: `Ticket #${extra} was completed 2026-04-08 and #${keeper} 2026-04-01, so charges would bill in a different week. Make the completed dates match first.`,
  });
  assert.deepEqual(await chargeSorts(extra), [{ item: "Jump", sort: 1 }]);
  assert.deepEqual(await chargeSorts(keeper), []);
});

test("reconcile skips a held pair, with one merge row, and the importing ticket stays open", async () => {
  const importer = await ticket({ wo: "WO-4206", customer: "Cafe" });
  const extra = await ticket({ wo: "WO-4206", customer: "Cafe" });
  const skipped = await reconcileServiceDuplicates(sql, "Chuy", [{ keeperId: importer, extraId: extra }]);
  assert.equal(skipped.merged, 0);
  const marked = await pg.query("select duplicate_of from service_jobs where id = any($1::int[])", [[importer, extra]]);
  assert.deepEqual(marked.rows.map((row) => row.duplicate_of), [null, null]);
  const review = attachHeldReview(
    [{ id: importer, wo: "WO-4206", customer: "Cafe", status: "Open", technician: null, entityType: "service", reason: "open" }],
    [{ keeperId: importer, extraId: extra, reason: "Ticket held", perRowExtra: extra }],
    [
      { id: importer, kind: "service", wo: "WO-4206", customer: "Cafe", status: "Open", technician: null, duplicate_of: null },
      { id: extra, kind: "service", wo: "WO-4206", customer: "Cafe", status: "Open", technician: null, duplicate_of: null },
    ],
  );
  assert.equal(review.filter((row) => row.reason === "merge").length, 1);
  assert.equal(review.find((row) => row.id === importer).reason, "open");
  assert.equal(review.find((row) => row.reason === "merge").id, extra);
});

async function mergeParams(keeper, extra, keeperUpdated, extraUpdated) {
  return [
    keeper,
    extra,
    "Chuy",
    "Cafe",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "2026-04-01",
    null,
    null,
    "Normal",
    keeperUpdated,
    extraUpdated,
  ];
}

test("a keeper that was already merged makes the statement write nothing", async () => {
  const keeper = await ticket({ wo: "WO-4207" });
  const extra = await ticket({ wo: "WO-4207" });
  const other = await ticket({ wo: "WO-4208" });
  await line(extra, 1, "Stay");
  await pg.query("update service_jobs set duplicate_of = $2 where id = $1", [keeper, other]);
  const stamps = await pg.query("select id, updated_at::text as updated from service_jobs where id = any($1::int[])", [[keeper, extra]]);
  const ku = stamps.rows.find((row) => Number(row.id) === keeper).updated;
  const eu = stamps.rows.find((row) => Number(row.id) === extra).updated;
  const rows = await sql.query(mergeTicketsSql(), await mergeParams(keeper, extra, ku, eu));
  assert.equal(rows.length, 0);
  assert.deepEqual(await chargeSorts(extra), [{ item: "Stay", sort: 1 }]);
});

test("an extra already merged into another ticket is refused", async () => {
  const keeper = await ticket({ wo: "WO-4209" });
  const extra = await ticket({ wo: "WO-4209" });
  const other = await ticket({ wo: "WO-4210" });
  await pg.query("update service_jobs set duplicate_of = $2 where id = $1", [extra, other]);
  assert.deepEqual(await mergeServiceJobs(sql, keeper, extra, "Chuy"), {
    refused: `Ticket #${extra} was already merged into #${other}.`,
  });
});

test("a changed updated_at makes the merge write nothing", async () => {
  const keeper = await ticket({ wo: "WO-4211" });
  const extra = await ticket({ wo: "WO-4211" });
  await line(extra, 1, "Stay");
  const rows = await sql.query(mergeTicketsSql(), await mergeParams(keeper, extra, "stale", "stale"));
  assert.equal(rows.length, 0);
  assert.deepEqual(await chargeSorts(extra), [{ item: "Stay", sort: 1 }]);
  assert.equal((await pg.query("select duplicate_of from service_jobs where id = $1", [extra])).rows[0].duplicate_of, null);
});

test("stale line ids are refused, and a save on the merged extra is refused", async () => {
  process.env.DATABASE_URL = "postgres://127.0.0.1:9/unused";
  const { writeTicketCharges } = await import("../src/lib/ops/charges-api.ts");
  const keeper = await ticket({ wo: "WO-4212" });
  const extra = await ticket({ wo: "WO-4212" });
  await line(keeper, 1, "Keep");
  await line(extra, 1, "Moved");
  const ids = (await pg.query("select id from ticket_charges where job_id = $1 order by id", [keeper])).rows.map((row) => Number(row.id));
  await assert.rejects(
    () => writeTicketCharges(sql, keeper, "user", { lines: [{ item: "Keep", description: "", qty: 1, rate: 10 }], lineIds: [ids[0] + 99] }),
    (err) => err instanceof Error && err.message === "These charges changed since you opened them. Reload and try again.",
  );
  assert.deepEqual(await chargeSorts(keeper), [{ item: "Keep", sort: 1 }]);
  assert.deepEqual(await mergeServiceJobs(sql, keeper, extra, "Chuy"), { keeperId: keeper, extraId: extra });
  await assert.rejects(
    () => writeTicketCharges(sql, extra, "user", { lines: [{ item: "New", description: "", qty: 1, rate: 10 }], lineIds: [] }),
    (err) => err instanceof Error && err.message === `This ticket was merged into #${keeper}. Add charges there.`,
  );
  await assert.rejects(
    () => writeTicketCharges(sql, keeper, "user", { lines: [{ item: "Keep", description: "", qty: 1, rate: 10 }], lineIds: ids }),
    (err) => err instanceof Error && err.message === "These charges changed since you opened them. Reload and try again.",
  );
  assert.deepEqual(await chargeSorts(keeper), [
    { item: "Keep", sort: 1 },
    { item: "Moved", sort: 2 },
  ]);
});

test("a merged ticket cannot take a Sales Order, and clearing one still works", async () => {
  process.env.DATABASE_URL = "postgres://127.0.0.1:9/unused";
  const { recordTicketSalesOrder } = await import("../src/lib/ops/charges-api.ts");
  const keeper = await ticket({ wo: "WO-4213" });
  const extra = await ticket({ wo: "WO-4213", nsSo: "SO1" });
  await pg.query("update service_jobs set duplicate_of = $2 where id = $1", [extra, keeper]);
  await assert.rejects(
    () => recordTicketSalesOrder(sql, extra, "user", "SO9"),
    (err) => err instanceof Error && err.message === `This ticket was merged into #${keeper}. Enter the Sales Order there.`,
  );
  assert.equal((await pg.query("select ns_so from service_jobs where id = $1", [extra])).rows[0].ns_so, "SO1");
  await recordTicketSalesOrder(sql, extra, "user", null);
  assert.equal((await pg.query("select ns_so from service_jobs where id = $1", [extra])).rows[0].ns_so, null);
});

test("the keeper's invoice row takes the merged customer and keeps the bill-to name", async () => {
  const keeper = await ticket({ wo: "WO-4214", customer: "Walk-in" });
  const extra = await ticket({ wo: "WO-4214", customer: "North Cafe" });
  await pg.query("insert into invoices (entity_type, entity_id, customer, bill_name) values ('service', $1, 'Walk-in', 'Keep bill')", [keeper]);
  assert.deepEqual(await mergeServiceJobs(sql, keeper, extra, "Chuy"), { keeperId: keeper, extraId: extra });
  const inv = await pg.query("select customer, bill_name from invoices where entity_type = 'service' and entity_id = $1", [keeper]);
  assert.equal(inv.rows[0].customer, "North Cafe");
  assert.equal(inv.rows[0].bill_name, "Keep bill");
});

test("the merge note says one charge line, and leaves out a blank work order", async () => {
  const one = await ticket({ wo: "WO-4215" });
  const extra = await ticket({ wo: "WO-4215" });
  await line(extra, 1, "Only");
  assert.deepEqual(await mergeServiceJobs(sql, one, extra, "Chuy"), { keeperId: one, extraId: extra });
  const oneDetail = await pg.query("select detail from activity where action = 'merged' and entity_id = $1", [one]);
  assert.match(oneDetail.rows[0].detail, /moved 1 charge line$/);
  assert.doesNotMatch(oneDetail.rows[0].detail, /charge lines/);

  const blank = await ticket({ wo: null });
  const other = await ticket({ wo: null });
  assert.deepEqual(await mergeServiceJobs(sql, blank, other, "Chuy"), { keeperId: blank, extraId: other });
  const blankDetail = await pg.query("select detail from activity where action = 'merged' and entity_id = $1", [blank]);
  assert.equal(blankDetail.rows[0].detail.includes("·  ·"), false);
  assert.match(blankDetail.rows[0].detail, /into this ticket · moved 0 charge lines/);
});
