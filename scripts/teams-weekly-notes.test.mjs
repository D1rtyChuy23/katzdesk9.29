// Teams notes, 11/2 (Chuy): the weekly Purchase Order report by manufacturer, the reps' serviced / Pipeline / installs
// sections, each region's assignments and the Service Monkeys get-ready list. The plain pieces. All data is made up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chicagoClock, countsForPo, OTHER_MAKER, partLabel, partMaker, piecesByPart, poReportWeek, pullChanges, pulledLabel, weekDayLabel } from "../src/lib/ops/po-report.ts";
import { planGetReady } from "../src/lib/ops/get-ready.ts";
import { machineNotesMissing, picturesNeeded } from "../src/lib/ops/install-needs.ts";
import { draftTeamsChat, teamsChat } from "../src/lib/ops/teams-message.ts";

/* ------------------------------------------------------------------ the week */

test("the report's week is Saturday to Friday and turns over Friday at 5 PM", () => {
  const week = (from, to) => ({ from, to });
  // Fri Oct 30, 2026: before 5 PM it is still the week before.
  assert.deepEqual(poReportWeek("2026-10-30", 16), week("2026-10-17", "2026-10-23"));
  assert.deepEqual(poReportWeek("2026-10-30", 17), week("2026-10-24", "2026-10-30"));
  assert.deepEqual(poReportWeek("2026-10-30", 23), week("2026-10-24", "2026-10-30"));
  // Saturday through Thursday read the Friday just past.
  for (const day of ["2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"]) {
    for (const hour of [0, 9, 17, 23]) assert.deepEqual(poReportWeek(day, hour), week("2026-10-24", "2026-10-30"), `${day} ${hour}`);
  }
  assert.deepEqual(poReportWeek("2026-11-06", 9), week("2026-10-24", "2026-10-30"));
  assert.deepEqual(poReportWeek("2026-11-06", 17), week("2026-10-31", "2026-11-06"));
  // Across a new year.
  assert.deepEqual(poReportWeek("2027-01-04", 8), week("2026-12-26", "2027-01-01"));
});

test("the hour is Chicago's, before and after daylight saving ends", () => {
  // Oct 30 is CDT (UTC-5); Nov 6 is CST (UTC-6).
  assert.deepEqual(chicagoClock(new Date("2026-10-30T21:59:00Z")), { date: "2026-10-30", hour: 16 });
  assert.deepEqual(chicagoClock(new Date("2026-10-30T22:00:00Z")), { date: "2026-10-30", hour: 17 });
  assert.deepEqual(chicagoClock(new Date("2026-11-06T22:59:00Z")), { date: "2026-11-06", hour: 16 });
  assert.deepEqual(chicagoClock(new Date("2026-11-06T23:00:00Z")), { date: "2026-11-06", hour: 17 });
  assert.deepEqual(chicagoClock(new Date("2026-11-07T05:30:00Z")), { date: "2026-11-06", hour: 23 });
  assert.deepEqual(chicagoClock(new Date("2026-11-07T06:00:00Z")), { date: "2026-11-07", hour: 0 });
  assert.equal(weekDayLabel("2026-10-24"), "Sat Oct 24");
  assert.equal(weekDayLabel("2026-10-30"), "Fri Oct 30");
});

test("a pull reports what is new since the pulls before it, and nothing twice", () => {
  const u = (k, p, q) => ({ k, p, q });
  const earlier = [u("service:1", 10, 2), u("service:2", 11, 1), u("pm:3", 12, 1), u("service:4", 99, 1)];
  const now = [
    // Same as reported: nothing.
    u("service:1", 10, 2),
    // One more piece on the same ticket.
    u("service:2", 11, 2),
    // A use entered late, or back-dated into a week already pulled: new.
    u("service:5", 10, 3),
    // pm:3's piece was taken off: -1 below.
    // Part 99 was merged into 13 since: the same use, not a new one.
    u("service:4", 13, 1),
  ];
  assert.deepEqual(pullChanges(now, earlier, new Map([[99, 13]])), [u("pm:3", 12, -1), u("service:2", 11, 1), u("service:5", 10, 3)]);
  // Without knowing the merge, part 13 would read new and part 99 taken off.
  assert.deepEqual(pullChanges(now, earlier), [u("pm:3", 12, -1), u("service:2", 11, 1), u("service:4", 13, 1), u("service:4", 99, -1), u("service:5", 10, 3)]);
  // Two pulls before: each one's change adds up.
  assert.deepEqual(pullChanges([u("service:1", 10, 5)], [u("service:1", 10, 2), u("service:1", 10, 1)]), [u("service:1", 10, 2)]);
  assert.deepEqual(pullChanges([u("service:1", 10, 0.1), u("service:1", 10, 0.2)], [u("service:1", 10, 0.3)]), []);
  assert.deepEqual([...piecesByPart([u("a", 10, 2), u("b", 10, 1.5), u("c", 11, -1)]).entries()], [[10, 3.5], [11, -1]]);
  assert.equal(pulledLabel("2026-10-30T22:30:00Z"), "Fri Oct 30 at 5:30 PM");
  assert.equal(pulledLabel("2026-11-07T00:05:00Z"), "Fri Nov 6 at 6:05 PM");
  assert.equal(pulledLabel("not a time"), "");
});

/* ------------------------------------------------------------------ the maker */

test("a part's maker is the one its description starts with, in any capitals", () => {
  const maker = (description, extra = {}) => partMaker({ description, sku: "ZZ1", item: "PARTS : ZZ1", ...extra });
  assert.equal(maker("Eversys Zz Test Gasket"), "Eversys");
  assert.equal(maker("BUNN ZZ SWITCH, MOMENTARY"), "Bunn");
  assert.equal(maker("La Marzocco Zz Steam Valve"), "La Marzocco");
  assert.equal(maker("Nuova Simonelli Zz Pump"), "Nuova Simonelli");
  assert.equal(maker("Victoria Arduino Zz Gasket"), "Victoria Arduino");
  assert.equal(maker("de Jong Duke Zz Motor"), "de Jong Duke");
  assert.equal(maker("De Jong Duke Zz Switch"), "de Jong Duke");
  assert.equal(maker("Bravilior Zz Lock"), "Bravilor");
  assert.equal(maker("Mahlkönig Zz Burrs"), "Mahlkonig");
  assert.equal(maker("FetcoSingle Zz Funnel"), "Fetco");
  assert.equal(maker("La Cimbali Zz Gasket"), "Cimbali");
  assert.equal(maker("Cimbali Zz Gasket"), "Cimbali");
  assert.equal(maker("Wilbur Curtis Zz Faucet"), "Curtis");
  assert.equal(maker("Everpure Zz Cartridge"), "Everpure");
  // A maker named later in the description is not the maker.
  assert.equal(maker("Zz Gasket for Eversys"), OTHER_MAKER);
  // Mazzer and Modbar parts NetSuite files under La Marzocco are Mazzer and Modbar; Casadio under Faema is Casadio.
  assert.equal(maker("Mazzer Zz Doser", { item: "LA MARZOCCO PARTS : M1" }), "Mazzer");
  assert.equal(maker("Modbar Zz Wand", { item: "LA MARZOCCO PARTS : LM1" }), "Modbar");
  assert.equal(maker("Casadio Zz Switch", { item: "FAEMAPARTS : CA1" }), "Casadio");
});

test("with no maker in front, the NetSuite group, then the SKU, else Other", () => {
  const blank = (item, sku, parent = null) => partMaker({ description: "", item, sku, parent });
  assert.equal(blank("BUNN PARTS : ZZ1", "ZZ1"), "Bunn");
  assert.equal(blank("FAEMAPARTS : ZZ1", "ZZ1"), "Faema");
  assert.equal(blank("NUOVASIMONELLI : ZZ1", "ZZ1"), "Nuova Simonelli");
  assert.equal(blank("LA MARZOCCO PARTS : ZZ1", "ZZ1"), "La Marzocco");
  assert.equal(blank("FETCO PARTS : ZZ1", "ZZ1"), "Fetco");
  // The parent column wins over the item's own prefix.
  assert.equal(blank("PARTS : ZZ1", "ZZ1", "Bunn Parts"), "Bunn");
  // A group that is not one maker says nothing.
  assert.equal(blank("PARTS : ZZ1", "ZZ1"), OTHER_MAKER);
  assert.equal(blank("WATER FILTERS : ZZ1", "ZZ1"), OTHER_MAKER);
  assert.equal(blank("TORANI : ZZ1", "ZZ1"), OTHER_MAKER);
  const sku = (s) => blank(`PARTS : ${s}`, s);
  assert.equal(sku("EVER109999"), "Eversys");
  assert.equal(sku("EVERSYSZZ"), "Eversys");
  assert.equal(sku("EVERPUREZZ"), "Everpure");
  assert.equal(sku("WFEV9999-99"), "Everpure");
  assert.equal(sku("EVERCLEANZZ"), OTHER_MAKER);
  assert.equal(sku("RAN19999999"), "Rancilio");
  assert.equal(sku("DIT299999"), "Ditting");
  assert.equal(sku("BB6.999.999.999"), "Bravilor");
  assert.equal(sku("DJD9ZZ999"), "de Jong Duke");
  assert.equal(sku("BWT899999"), "BWT");
  assert.equal(sku("MAHL799999"), "Mahlkonig");
  assert.equal(sku("FFF9999"), "Frosty Factory");
  assert.equal(sku("CA999999999"), "Casadio");
  assert.equal(sku("lm 9.999"), "La Marzocco");
  assert.equal(sku("FA9999999"), "Faema");
  assert.equal(sku("NS99999"), "Nuova Simonelli");
  assert.equal(sku("BUNN99999.9999"), "Bunn");
  assert.equal(sku("FETCO199999"), "Fetco");
  // Letters that only look like a prefix.
  assert.equal(sku("RANDOMZZ"), OTHER_MAKER);
  assert.equal(sku("CAMBROZZ"), OTHER_MAKER);
  assert.equal(sku("FAUCETZZ"), OTHER_MAKER);
  assert.equal(sku("NSFZZ"), OTHER_MAKER);
  assert.equal(partMaker({}), OTHER_MAKER);
});

test("under its maker's heading a part reads without the maker in front", () => {
  assert.equal(partLabel({ description: "Eversys Zz O-Ring 6x1" }, "Eversys"), "Zz O-Ring 6x1");
  assert.equal(partLabel({ description: "BUNN ZZ SWITCH, MOMENTARY" }, "Bunn"), "ZZ SWITCH, MOMENTARY");
  assert.equal(partLabel({ description: "Fetco - Zz Funnel" }, "Fetco"), "Zz Funnel");
  // A maker read from the group or the SKU leaves the description whole.
  assert.equal(partLabel({ description: "Zz Group Gasket" }, "La Marzocco"), "Zz Group Gasket");
  assert.equal(partLabel({ description: "Eversys" }, "Eversys"), "Eversys");
  // No description: the line has the SKU already.
  assert.equal(partLabel({ description: "" }, "Bunn"), "");
  assert.equal(partLabel({ description: null }, OTHER_MAKER), "");
});

test("the report counts parts and water filters, and parts with no class yet; not equipment or service", () => {
  assert.equal(countsForPo({ itemClass: "Parts", kind: "part" }), true);
  assert.equal(countsForPo({ itemClass: "Water Filters", kind: "part" }), true);
  assert.equal(countsForPo({ itemClass: "Equipment", kind: "equipment" }), false);
  assert.equal(countsForPo({ itemClass: "Equipment", kind: "part" }), false);
  assert.equal(countsForPo({ itemClass: "Dispensers", kind: "part" }), false);
  assert.equal(countsForPo({ itemClass: "Service", kind: "part" }), false);
  assert.equal(countsForPo({ itemClass: null, kind: "part" }), true);
  assert.equal(countsForPo({ itemClass: "  ", kind: "other" }), true);
  assert.equal(countsForPo({ itemClass: "", kind: "equipment" }), false);
  assert.equal(countsForPo({}), true);
});

/* ------------------------------------------------------------------ the Purchase Order note */

const empty = {
  when: "2026-11-02 9:00 AM CT",
  attention: [],
  duplicateWo: [],
  calls: [],
  kpiScope: "",
  kpi: [],
  finance: null,
};
const draft = (id, snap) => draftTeamsChat(teamsChat(id), { ...empty, ...snap }).text;
const part = (maker, sku, label, pieces) => ({ maker, sku, label, pieces });
// Pulled Fri Oct 30, 2026 at 5:30 PM in Chicago (CDT).
const PULLED = "2026-10-30T22:30:00Z";
const week = (parts) => ({ from: "2026-10-24", to: "2026-10-30", pulledAt: PULLED, parts });
const INTRO = "Parts and water filters used, by manufacturer, for the week Sat Oct 24 to Fri Oct 30, and any entered late from earlier weeks. Pulled Fri Oct 30 at 5:30 PM for Monday morning; nothing is counted twice. Place the orders in NetSuite.";

test("the Purchase Order note lists every part used that week under its maker, most pieces first and Other last", () => {
  const po = {
    from: "2026-10-24",
    to: "2026-10-30",
    pulledAt: PULLED,
    parts: [
      part(OTHER_MAKER, "ZZOTHER1", "Zz Tamper", 9),
      part("Bunn", "BUNNZZ2", "ZZ GASKET", 1),
      part("Eversys", "EVERZZ1", "Zz O-Ring", 4),
      part("Bunn", "BUNNZZ1", "ZZ SWITCH", 3),
      part("Eversys", "EVERZZ2", "Zz Thermostat", 1.5),
      part("Ditting", "DITZZ1", "Zz Burrs", 4),
      part("Bunn", "BUNNZZ3", "ZZ VALVE", 1),
    ],
  };
  assert.equal(
    draft("purchase-orders", { po }),
    [
      INTRO,
      "Eversys · 2 parts, 5.5 pieces\n- EVERZZ1 · Zz O-Ring · 4\n- EVERZZ2 · Zz Thermostat · 1.5",
      "Bunn · 3 parts, 5 pieces\n- BUNNZZ1 · ZZ SWITCH · 3\n- BUNNZZ2 · ZZ GASKET · 1\n- BUNNZZ3 · ZZ VALVE · 1",
      "Ditting · 1 part, 4 pieces\n- DITZZ1 · Zz Burrs · 4",
      "Other · 1 part, 9 pieces\n- ZZOTHER1 · Zz Tamper · 9",
    ].join("\n\n"),
  );
  assert.equal(draft("purchase-orders", { po: week([part("Bunn", "", "ZZ Kit", 1)]) }).split("\n\n")[1], "Bunn · 1 part, 1 piece\n- No SKU · ZZ Kit · 1");
  assert.equal(draft("purchase-orders", { po: week([part("Bunn", "BUNNZZ9", "", 2)]) }).split("\n\n")[1], "Bunn · 1 part, 2 pieces\n- BUNNZZ9 · 2");
  assert.equal(draft("purchase-orders", { po: week([]) }), `${INTRO}\n\nNone used that week.`);
  // Pieces taken off tickets after an earlier report are listed last, on their own.
  assert.equal(
    draft("purchase-orders", { po: week([part("Bunn", "BUNNZZ1", "ZZ SWITCH", 2), part("Eversys", "EVERZZ9", "Zz Probe", -1), part("Bunn", "BUNNZZ2", "ZZ GASKET", -2)]) }),
    `${INTRO}\n\nBunn · 1 part, 2 pieces\n- BUNNZZ1 · ZZ SWITCH · 2\n\nTaken off tickets after an earlier report\n- BUNNZZ2 · ZZ GASKET · -2\n- EVERZZ9 · Zz Probe · -1`,
  );
  assert.equal(draft("purchase-orders", { po: week([part("Bunn", "BUNNZZ2", "ZZ GASKET", -2)]) }), `${INTRO}\n\nTaken off tickets after an earlier report\n- BUNNZZ2 · ZZ GASKET · -2`);
});

test("a week too long for one note lists what fits and says how many more", () => {
  const parts = Array.from({ length: 400 }, (_, i) => part(i < 200 ? "Bunn" : "Fetco", `ZZ${String(i).padStart(4, "0")}`, `Zz part ${"x".repeat(60)} ${i}`, 1));
  const text = draft("purchase-orders", { po: week(parts) });
  assert.ok(text.length <= 18_100, String(text.length));
  const listed = text.split("\n").filter((l) => l.startsWith("- ")).length;
  assert.ok(listed > 100 && listed < 400, String(listed));
  assert.ok(text.endsWith(`And ${400 - listed} more parts.`), text.slice(-60));
  // Every week that fits is listed whole.
  const fits = draft("purchase-orders", { po: week(parts.slice(0, 120)) });
  assert.equal(fits.split("\n").filter((l) => l.startsWith("- ")).length, 120);
  assert.doesNotMatch(fits, /more parts?\.$/);
});

/* ------------------------------------------------------------------ the rep notes */

const call = (extra) => ({ customer: "Zz Cafe", rep: "", tech: "", tech2: "", region: "other", status: "Open", when: "", issue: "", ref: "SC-1", ...extra });
const install = (extra) => ({ customer: "Zz Cafe", rep: "", date: "", machines: 1, power: [], water: [], pictures: { needed: false, machines: [] }, ...extra });

test("a rep's note: what we serviced since the last note, open calls, the Pipeline and installs, theirs only", () => {
  const snap = {
    servicedFrom: { "rep-sean": "2026-10-30" },
    servicedDefault: "2026-10-26",
    serviced: [
      { customer: "Zz Blue", rep: "Sean Marshall", kind: "Service call", date: "2026-10-31", ref: "WO-1", tech: "Ryan Gloria", what: "Replaced burrs" },
      { customer: "Zz Coco", rep: "Sean Marshall", kind: "PM", date: "2026-11-01", ref: "WO-2", tech: "Josh", what: "" },
      { customer: "Zz Owl", rep: "Sean Marshall", kind: "Phone Resolved", date: "2026-10-30", ref: "", tech: "", what: "Reset" },
      { customer: "Zz Early", rep: "Sean Marshall", kind: "Service call", date: "2026-10-29", ref: "WO-3", tech: "Lance Oden", what: "" },
      { customer: "Zz Hers", rep: "Lizbeth Romero", kind: "Service call", date: "2026-10-28", ref: "WO-4", tech: "Lance Oden", what: "Leak" },
    ],
    calls: [call({ customer: "Zz Blue", rep: "Sean Marshall", status: "Scheduled", when: "2026-11-03", issue: "Grinder jam", ref: "SC-9" }), call({ customer: "Zz Hers", rep: "Liz" })],
    deals: [
      { customer: "Zz Blue", rep: "Sean Marshall", equipment: "Linea PB, Mythos One", stage: "Ordered", eta: "Nov 10" },
      { customer: "Zz New", rep: "Sean Marshall", equipment: "", stage: "Good to order", eta: "Nov 20" },
      { customer: "Zz Maybe", rep: "Sean", equipment: "Axiom", stage: "Needs good to order", eta: "" },
      { customer: "Zz Hers", rep: "Lizbeth Romero", equipment: "ITCB", stage: "Ordered", eta: "" },
    ],
    installs: [
      install({ customer: "Zz Blue", rep: "Sean Marshall", date: "2026-11-12", machines: 2, power: ["Linea PB", "Linea PB", "Mythos One"], water: ["Linea PB"], pictures: { needed: true, machines: ["Linea PB"] } }),
      install({ customer: "Zz New", rep: "Sean Marshall", pictures: { needed: true, machines: [] } }),
      install({ customer: "Zz Done", rep: "Sean Marshall", date: "2026-11-20" }),
      install({ customer: "Zz Empty", rep: "Sean Marshall", machines: 0, pictures: { needed: false, machines: [] } }),
      install({ customer: "Zz Hers", rep: "Liz" }),
    ],
  };
  assert.equal(
    draft("rep-sean", snap),
    [
      "Your accounts: the service we did, open calls, the Pipeline and installs.",
      "Serviced since Fri Oct 30\n- Zz Coco · 2026-11-01 · PM · WO-2 · Josh\n- Zz Blue · 2026-10-31 · Service call · WO-1 · Ryan Gloria · Replaced burrs\n- Zz Owl · 2026-10-30 · Phone Resolved · No number · Reset",
      "Open service calls\n- Zz Blue · Scheduled · 2026-11-03 · SC-9 · Grinder jam",
      "Pipeline\n- Zz Blue · Linea PB, Mythos One · Ordered · ETA Nov 10\n- Zz New · No equipment listed · Good to order\n- Zz Maybe · Axiom · Needs good to order",
      [
        "Installs",
        "- Zz Blue · 2026-11-12 · Missing power notes (Linea PB, Mythos One) · Missing water notes (Linea PB) · Needs pre-inspection pictures (Linea PB)",
        "- Zz New · No install date · Needs pre-inspection pictures",
        "- Zz Done · 2026-11-20 · Power and water notes and pictures are in",
        "- Zz Empty · No install date · No equipment listed",
      ].join("\n"),
    ].join("\n\n"),
  );
  // Liz's chat has the week before as its start (no earlier note) and only her rows.
  const liz = draft("rep-liz", snap);
  assert.match(liz, /^Your accounts: .*\n\nServiced since Mon Oct 26\n- Zz Hers · 2026-10-28 · Service call · WO-4 · Lance Oden · Leak\n\nOpen service calls\n- Zz Hers · Open · SC-1\n\nPipeline\n- Zz Hers · ITCB · Ordered\n\nInstalls\n- Zz Hers · No install date · Power and water notes and pictures are in$/);
  assert.doesNotMatch(liz, /Zz Blue|Zz Coco/);
  // Nothing on a rep's accounts.
  assert.equal(
    draft("rep-amanda", snap),
    "Your accounts: the service we did, open calls, the Pipeline and installs.\n\nServiced since Mon Oct 26\nNone.\n\nOpen service calls\nNone.\n\nPipeline\nNone open.\n\nInstalls\nNone open.",
  );
});

test("an install's needs name its machines and are cut only past 320 characters", () => {
  const long = "La Marzocco Linea PB 2GR AV Zz Edition";
  const line = (power, water, pics) =>
    draft("rep-amanda", { servicedDefault: "2026-10-26", installs: [install({ customer: "Zz Long", rep: "Amanda Logg", date: "2026-11-12", power, water, pictures: { needed: true, machines: pics } })] })
      .split("\n")
      .find((l) => l.startsWith("- Zz Long"));
  const kept = line([long], [long], [long, "Mazzer Super Jolly"]);
  assert.ok(kept.length > 162, String(kept.length));
  assert.ok(kept.endsWith("Needs pre-inspection pictures (La Marzocco Linea PB 2GR AV Zz Edition, Mazzer Super Jolly)"), kept);
  const cut = line([long, `${long} 2`, `${long} 3`], [long, `${long} 2`], [long, `${long} 2`, `${long} 3`]);
  assert.equal(cut.length, 2 + 320);
  assert.ok(cut.endsWith("…"));
});

test("each section of a rep's note shows fifteen lines and says how many more", () => {
  const many = Array.from({ length: 18 }, (_, i) => install({ customer: `Zz ${String(i).padStart(2, "0")}`, rep: "Amanda Logg" }));
  const deals = Array.from({ length: 16 }, (_, i) => ({ customer: `Zz D${String(i).padStart(2, "0")}`, rep: "Amanda Logg", equipment: "Axiom", stage: "Good to order", eta: "" }));
  const text = draft("rep-amanda", { installs: many, deals, servicedDefault: "2026-10-26" });
  assert.match(text, /- Zz D14 · Axiom · Good to order\nAnd 1 more\.\n\nInstalls\n/);
  assert.match(text, /- Zz 14 · No install date · Power and water notes and pictures are in\nAnd 3 more\.$/);
  assert.doesNotMatch(text, /Zz 15|Zz D15/);
});

/* ------------------------------------------------------------------ the regions */

test("a region's note: who has each call so far, with each tech's count, then the calls with no tech", () => {
  const calls = [
    call({ customer: "Zz B", region: "dfw", tech: "Bill McKinley", when: "2026-11-04", ref: "SC-2" }),
    call({ customer: "Zz A", region: "dfw", tech: "Bill McKinley", when: "2026-11-03", ref: "SC-1", issue: "Leak" }),
    call({ customer: "Zz C", region: "dfw", tech: "Brandon Chappell", tech2: "Bill McKinley", ref: "SC-3" }),
    call({ customer: "Zz D", region: "dfw", status: "Open", ref: "SC-4" }),
    call({ customer: "Zz Away", region: "sa-atx", tech: "Lance Oden", ref: "SC-5" }),
    // Not on the roster: as typed. Fewer calls than Bill, so after him though its name sorts first.
    call({ customer: "Zz E", region: "dfw", tech: "Aaron Zz", ref: "SC-6" }),
    // "Bill" is Bill McKinley.
    call({ customer: "Zz F", region: "dfw", tech: "Bill", when: "2026-11-05", ref: "SC-7" }),
    // No date: after his dated calls.
    call({ customer: "Zz 0", region: "dfw", tech: "Bill McKinley", ref: "SC-8" }),
  ];
  assert.equal(
    draft("dfw", { calls }),
    [
      "Open service calls in this region, and who has them.",
      "Assigned so far (Bill McKinley 5, Aaron Zz 1, Brandon Chappell 1)\n- Aaron Zz · Zz E · Open · SC-6\n- Bill McKinley · Zz A · Open · 2026-11-03 · SC-1 · Leak\n- Bill McKinley · Zz B · Open · 2026-11-04 · SC-2\n- Bill McKinley · Zz F · Open · 2026-11-05 · SC-7\n- Bill McKinley · Zz 0 · Open · SC-8\n- Brandon Chappell & Bill McKinley · Zz C · Open · SC-3",
      "No tech yet\n- Zz D · Open · SC-4",
    ].join("\n\n"),
  );
  assert.equal(draft("sa-atx", { calls: [] }), "Open service calls in this region, and who has them.\n\nAssigned so far\nNone.\n\nNo tech yet\nNone.");
});

test("Service Monkeys: each tech's open calls everywhere, the calls there with no tech, then the get-ready list", () => {
  const getReady = [
    { date: "2026-11-04", time: "9a", customer: "Zz Blue", model: "Linea PB", serial: "ZZ-1", state: "pulled", where: "Back · A-L1", unitSerial: "ZZ-1", more: 0, needsTest: true },
    { date: "2026-11-04", time: "9a", customer: "Zz Blue", model: "Mythos One", serial: "", state: "to-pull", where: "Front · C-L2", unitSerial: "ZZ-7", more: 2, needsTest: false },
    { date: "2026-11-05", time: "", customer: "Zz Coco", model: "Axiom", serial: "", state: "none", where: "", unitSerial: "", more: 0, needsTest: false },
    { date: "2026-11-06", time: "", customer: "Zz Owl", model: "ITCB", serial: "ZZ-9", state: "to-pull", where: "Back · B-L1", unitSerial: "ZZ-9", more: 0, needsTest: true },
    { date: "2026-11-06", time: "", customer: "Zz Owl", model: "Bunn G9", serial: "", state: "pulled", where: "", unitSerial: "ZZ-3", more: 0, needsTest: false },
  ];
  const calls = [
    call({ customer: "Zz Houston", tech: "Ryan Gloria", ref: "SC-7" }),
    call({ customer: "Zz Katy", ref: "SC-8" }),
    // No tech, in DFW: that chat's, not this one's.
    call({ customer: "Zz Dallas", region: "dfw", ref: "SC-9" }),
    // A tech's calls in DFW and SA/ATX are his too, tagged with the region; a call with two techs is under both.
    call({ customer: "Zz Plano", region: "dfw", tech: "Josh", when: "2026-11-04", ref: "SC-10" }),
    call({ customer: "Zz Austin", region: "sa-atx", tech: "Ryan Gloria", tech2: "Joshua Harper", when: "2026-11-03", ref: "SC-11", issue: "Leak" }),
  ];
  assert.equal(
    draft("service-monkeys", { calls, getReady }),
    [
      "Each tech's open calls, the calls outside Dallas–Fort Worth and San Antonio–Austin that still need a tech, and the equipment to get ready for installs this week and next.",
      "Joshua Harper · 2 open calls\n- Zz Plano · Open · 2026-11-04 · SC-10 · DFW\n- Zz Austin · Open · 2026-11-03 · SC-11 · Leak · SA/ATX",
      "Ryan Gloria · 2 open calls\n- Zz Houston · Open · SC-7\n- Zz Austin · Open · 2026-11-03 · SC-11 · Leak · SA/ATX",
      "No tech yet\n- Zz Katy · Open · SC-8",
      [
        "Get ready: installs this week and next",
        "- 2026-11-04 9a · Zz Blue · Linea PB · SN ZZ-1 · pulled from Back · A-L1 · needs shop test",
        "- 2026-11-04 9a · Zz Blue · Mythos One · to pull from Front · C-L2 (SN ZZ-7) · 2 more in stock",
        "- 2026-11-05 · Zz Coco · Axiom · none in stock",
        "- 2026-11-06 · Zz Owl · ITCB · SN ZZ-9 · to pull from Back · B-L1 · needs shop test",
        "- 2026-11-06 · Zz Owl · Bunn G9 · pulled",
      ].join("\n"),
    ].join("\n\n"),
  );
  assert.equal(
    draft("service-monkeys", {}),
    "Each tech's open calls, the calls outside Dallas–Fort Worth and San Antonio–Austin that still need a tech, and the equipment to get ready for installs this week and next.\n\nAssigned so far\nNone.\n\nNo tech yet\nNone.\n\nGet ready: installs this week and next\nNo installs this week or next.",
  );
  // The get-ready list shows 30 machines before "And N more."
  const long = Array.from({ length: 33 }, (_, i) => ({ ...getReady[2], customer: `Zz ${String(i).padStart(2, "0")}` }));
  const text = draft("service-monkeys", { getReady: long });
  assert.match(text, /- 2026-11-05 · Zz 29 · Axiom · none in stock\nAnd 3 more\.$/);
  // DFW and SA/ATX have no get-ready list.
  assert.doesNotMatch(draft("dfw", { getReady }), /Get ready/);
});

/* ------------------------------------------------------------------ what an install needs */

test("power notes are volts and plug; water notes only on a machine that takes water", () => {
  const m = (equipment, extra = {}) => ({ equipment, serial: "", powerVoltage: "", plug: "", water: "", ...extra });
  assert.deepEqual(
    machineNotesMissing([
      m("La Marzocco Linea PB", { powerVoltage: "208V", plug: "L6-30P", water: "3/8 line" }),
      m("Mazzer Super Jolly", { powerVoltage: "120V" }),
      m("Bunn Axiom DV", { powerVoltage: "120V", plug: "5-15P" }),
      m("Fetco CBS-2152", { plug: "L14-30P", water: "1/4 line" }),
      m("Zz Mystery Box", { powerVoltage: "120V", plug: "5-15P" }),
      m("  "),
    ]),
    // A grinder takes no water; an unknown model's water is optional.
    { power: ["Mazzer Super Jolly", "Fetco CBS-2152"], water: ["Bunn Axiom DV"] },
  );
  assert.deepEqual(machineNotesMissing([]), { power: [], water: [] });
});

test("pre-inspection pictures: every check a unit uses needs one unless it is N/A", () => {
  const unit = (extra) => ({ model: "Linea PB", preInspected: false, categories: ["power", "water", "drain", "space"], coreNeeded: null, statuses: {}, photos: {}, ...extra });
  const all = { power: 1, water: 2, drain: 1, space: 1 };
  const none = { hasMachines: true, overridden: false };
  assert.deepEqual(picturesNeeded([unit({ photos: all })], none), { needed: false, machines: [] });
  assert.deepEqual(picturesNeeded([unit({ photos: { ...all, drain: 0 } })], none), { needed: true, machines: ["Linea PB"] });
  assert.deepEqual(picturesNeeded([unit({ photos: { power: 1, water: 1, space: 1 }, statuses: { drain: "N/A" } })], none), { needed: false, machines: [] });
  // A failed or passed check with no picture still needs one.
  assert.deepEqual(picturesNeeded([unit({ photos: { power: 1, water: 1, space: 1 }, statuses: { drain: "Fail" } })], none), { needed: true, machines: ["Linea PB"] });
  // The core hole needs one only when the counter needs a core.
  assert.deepEqual(picturesNeeded([unit({ photos: all, coreNeeded: "yes" })], none), { needed: true, machines: ["Linea PB"] });
  assert.deepEqual(picturesNeeded([unit({ photos: { ...all, core: 1 }, coreNeeded: "yes" })], none), { needed: false, machines: [] });
  assert.deepEqual(picturesNeeded([unit({ photos: all, coreNeeded: "no" })], none), { needed: false, machines: [] });
  // Existing equipment is already pre-inspected.
  assert.deepEqual(picturesNeeded([unit({ preInspected: true }), unit({ model: "Mythos One", categories: ["power", "space"], photos: { power: 1 } })], none), { needed: true, machines: ["Mythos One"] });
  // No units yet: all its machines need them, none named; nothing to shoot with no machines; an override needs none.
  assert.deepEqual(picturesNeeded([], none), { needed: true, machines: [] });
  assert.deepEqual(picturesNeeded([], { hasMachines: false, overridden: false }), { needed: false, machines: [] });
  assert.deepEqual(picturesNeeded([unit()], { hasMachines: true, overridden: true }), { needed: false, machines: [] });
});

/* ------------------------------------------------------------------ the get-ready list */

test("get ready: pulled units by serial, then by model; stock goes to one machine only, soonest install first", () => {
  const unit = (id, model, serial, where, extra = {}) => ({ id, model, serial, where, tested: false, needsTest: false, ...extra });
  const installs = [
    {
      id: 2,
      date: "2026-11-05",
      time: "",
      customer: "Zz Later",
      machines: [{ model: "Mythos One", serial: "" }, { model: "Bunn Axiom DV", serial: "" }],
      pulled: [],
    },
    {
      id: 1,
      date: "2026-11-04",
      time: "9a",
      customer: "Zz Soon",
      machines: [{ model: "Linea PB", serial: "" }, { model: "Linea PB", serial: "LP-2" }, { model: "Mythos One", serial: "" }, { model: "ITCB", serial: "IT-9" }],
      pulled: [unit(10, "Linea PB", "LP-1", "Back · A-L1"), unit(11, "Linea PB", "LP-2", "Back · A-L2", { needsTest: true })],
    },
  ];
  const stock = [
    unit(20, "Mythos One", "MY-1", "Front · C-L1", { needsTest: true }),
    unit(21, "mythos one", "MY-2", "Front · C-L3", { tested: true }),
    unit(22, "Bunn ITCB", "IT-8", "Back · B-L1"),
  ];
  const lines = planGetReady(installs, stock, []);
  const short = lines.map((l) => [l.customer, l.model, l.serial, l.state, l.where, l.unitSerial, l.more, l.needsTest]);
  assert.deepEqual(short, [
    // The pulled LP-2 goes to the row with that serial; the other pulled Linea to the row with none.
    ["Zz Soon", "Linea PB", "LP-1", "pulled", "Back · A-L1", "LP-1", 0, false],
    ["Zz Soon", "Linea PB", "LP-2", "pulled", "Back · A-L2", "LP-2", 0, true],
    // The shop-tested Mythos is picked first; one is left for the next install.
    ["Zz Soon", "Mythos One", "", "to-pull", "Front · C-L3", "MY-2", 1, false],
    // A machine with a serial no stock unit has is none, even with another unit of its model in stock.
    ["Zz Soon", "ITCB", "IT-9", "none", "", "", 0, false],
    ["Zz Later", "Mythos One", "", "to-pull", "Front · C-L1", "MY-1", 0, true],
    ["Zz Later", "Bunn Axiom DV", "", "none", "", "", 0, false],
  ]);
  // The stock unit with a machine's own serial is that machine's (serials read without case or spaces).
  const own = planGetReady([{ ...installs[1], id: 3, pulled: [], machines: [{ model: "ITCB", serial: " it-8 " }] }], stock, []);
  assert.deepEqual(own.map((l) => [l.state, l.unitSerial, l.where]), [["to-pull", "IT-8", "Back · B-L1"]]);
  // A model the catalog reads as the same one matches.
  const named = planGetReady(
    [{ id: 4, date: "2026-11-04", time: "", customer: "Zz Cat", machines: [{ model: 'Bunn ITCB-DV, 29" w/Flip Tray', serial: "" }], pulled: [] }],
    [unit(30, "Bunn ITCB-DV", "IT-1", "Back · B-L2")],
    ["Bunn ITCB-DV"],
  );
  assert.deepEqual(named.map((l) => [l.state, l.unitSerial]), [["to-pull", "IT-1"]]);
  assert.deepEqual(planGetReady([], stock, []), []);
});

test("get ready: a serial wins its unit whatever the order; the day's installs go by time", () => {
  const unit = (id, model, serial, where, extra = {}) => ({ id, model, serial, where, tested: false, needsTest: false, ...extra });
  const ins = (id, date, at, customer, machines, pulled = []) => ({ id, date, time: at, at, customer, machines, pulled });
  // The earlier install has no serial; the later one has MY-2. MY-2 is the later one's, and the earlier one gets MY-1.
  const stock = [unit(1, "Mythos One", "MY-2", "Front · C-L1"), unit(2, "Mythos One", "MY-1", "Front · C-L2")];
  const lines = planGetReady(
    [ins(7, "2026-11-05", "", "Zz Later", [{ model: "Mythos One", serial: "MY-2" }]), ins(6, "2026-11-04", "", "Zz Sooner", [{ model: "Mythos One", serial: "" }])],
    stock,
  );
  assert.deepEqual(lines.map((l) => [l.customer, l.state, l.unitSerial]), [["Zz Sooner", "to-pull", "MY-1"], ["Zz Later", "to-pull", "MY-2"]]);
  // Pulled units in either order: the serial's unit to its row, the other to the row with none.
  for (const pulled of [[unit(11, "Linea PB", "LP-2", "Back · A-L2"), unit(10, "Linea PB", "LP-1", "Back · A-L1")], [unit(10, "Linea PB", "LP-1", "Back · A-L1"), unit(11, "Linea PB", "LP-2", "Back · A-L2")]]) {
    const got = planGetReady([ins(1, "2026-11-04", "", "Zz Soon", [{ model: "Linea PB", serial: "" }, { model: "Linea PB", serial: "LP-2" }], pulled)], []);
    assert.deepEqual(got.map((l) => [l.serial, l.unitSerial]), [["LP-1", "LP-1"], ["LP-2", "LP-2"]]);
  }
  // 8:00 before 10:00 before 1 PM before no time, on the same day.
  const day = planGetReady(
    [
      ins(1, "2026-11-04", "13:00", "Zz A", [{ model: "Zz Machine", serial: "" }]),
      ins(2, "2026-11-04", "", "Zz B", [{ model: "Zz Machine", serial: "" }]),
      ins(3, "2026-11-04", "10:00", "Zz C", [{ model: "Zz Machine", serial: "" }]),
      ins(4, "2026-11-04", "08:00", "Zz D", [{ model: "Zz Machine", serial: "" }]),
    ],
    [],
  );
  assert.deepEqual(day.map((l) => l.customer), ["Zz D", "Zz C", "Zz A", "Zz B"]);
  // A stock row of two units serves two machines.
  const two = planGetReady(
    [ins(1, "2026-11-04", "", "Zz A", [{ model: "Mazzer Super Jolly", serial: "" }]), ins(2, "2026-11-05", "", "Zz B", [{ model: "Mazzer Super Jolly", serial: "" }])],
    [unit(5, "Mazzer Super Jolly", "", "Back · B-L1"), unit(5, "Mazzer Super Jolly", "", "Back · B-L1")],
  );
  assert.deepEqual(two.map((l) => [l.state, l.more]), [["to-pull", 1], ["to-pull", 0]]);
});
