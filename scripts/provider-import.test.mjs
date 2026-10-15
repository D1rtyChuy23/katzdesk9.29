import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROVIDER_IMPORT_HEADER,
  countProviderPlan,
  pinQualityOf,
  planProviderImport,
  providerRowsFromMatrix,
  providerWrites,
  sameAddress,
  streetKey,
} from "../src/lib/ops/provider-import.ts";

/** A file row in the contract order; unspecified cells are blank. */
function fileRow(o = {}) {
  const v = {
    "Provider ID": "", "Current Name": "", Name: "", "Merge Into": "", Status: "", Address: "", City: "", State: "", ZIP: "",
    "Dispatch Phone": "", "Dispatch Email": "", Website: "", Coverage: "", Latitude: "", Longitude: "", "Match Type": "",
    "Matched Address": "", Verified: "", Notes: "", ...o,
  };
  return PROVIDER_IMPORT_HEADER.map((h) => v[h]);
}
const rowsOf = (...rows) => providerRowsFromMatrix([[...PROVIDER_IMPORT_HEADER], ...rows.map(fileRow)]);

function provider(o) {
  return {
    archived: false, mergedInto: null, status: null, dispatchPhone: null, dispatchEmail: null, website: null, coverage: null,
    addresses: [], assignments: [], contacts: 0, coverageRows: 0, ...o,
  };
}

const PROVIDERS = () => [
  provider({ id: 1, name: "A-1 Restuarant Service", coverage: "TX", addresses: [{ id: 11, label: null, line1: "1407 Tulip Ln.", city: "Odessa", state: "TX", zip: "79761", latitude: null, longitude: null, quality: null }] }),
  provider({ id: 2, name: "STCS", status: "Active", dispatchPhone: "956-536-7846", dispatchEmail: "alanmcgee@msn.com", assignments: [{ customer: "cafe uno", role: "primary" }] }),
  provider({ id: 3, name: "Espresso Tech", dispatchPhone: "314-555-0100", assignments: [{ customer: "cafe uno", role: "secondary" }, { customer: "cafe dos", role: "primary" }], contacts: 2, coverageRows: 3, addresses: [{ id: 31, label: null, line1: "9 Elm St", city: "St Louis", state: "MO", zip: "63101", latitude: null, longitude: null, quality: null }] }),
  provider({ id: 4, name: "ETSC (EspressoTech Service Company)", status: "Active", assignments: [{ customer: "cafe uno", role: "additional" }] }),
  provider({ id: 5, name: "Old Closed Co", archived: true }),
];

test("rows read from the contract layout: blanks skipped, IDs and coordinates as numbers, header required", () => {
  const rows = rowsOf(
    { "Provider ID": "12", "Current Name": "STCS", Latitude: "26.2412", Longitude: "-97.7286" },
    {},
    { Name: "  New   Shop  ", Coverage: "TX\nNM ZIPs: 87002" },
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].line, 2);
  assert.equal(rows[0].providerId, 12);
  assert.equal(rows[0].latitude, 26.2412);
  assert.equal(rows[1].line, 4);
  assert.equal(rows[1].name, "New Shop");
  assert.equal(rows[1].coverage, "TX\nNM ZIPs: 87002");
  assert.equal(rows[1].providerId, null);
  assert.throws(() => providerRowsFromMatrix([["Phone", "Email"], ["1", "2"]]), /Name or Current Name/);
});

test("match type mapping: Exact, Non_Exact, ZIP area; No_Match and bad coordinates give no pin", () => {
  assert.equal(pinQualityOf("Exact", 29.7, -95.3), "exact");
  assert.equal(pinQualityOf("Non_Exact", 29.7, -95.3), "close");
  assert.equal(pinQualityOf("ZIP area", 29.7, -95.3), "approx");
  assert.equal(pinQualityOf("zip_area", 29.7, -95.3), "approx");
  assert.equal(pinQualityOf("Approximate", 29.7, -95.3), "approx");
  assert.equal(pinQualityOf("No_Match", 29.7, -95.3), null);
  assert.equal(pinQualityOf("Exact", null, null), null);
  assert.equal(pinQualityOf("Exact", 0, 0), null);
  assert.equal(pinQualityOf("Exact", 120, -95), null);
  assert.equal(pinQualityOf("", 29.7, -95.3), "close", "coordinates with no type are a close match");
});

test("matching: Provider ID first, then Current Name, then Name, ignoring case and outer spaces", () => {
  const lines = planProviderImport(
    rowsOf(
      { "Provider ID": "2", "Current Name": "Something Else" },
      { "Current Name": "  stcs " },
      { Name: "a-1 restuarant service" },
      { "Provider ID": "999", "Current Name": "STCS", Status: "Active" },
    ),
    PROVIDERS(),
  );
  assert.equal(lines[0].providerId, 2);
  assert.equal(lines[0].matchedBy, "provider ID");
  assert.equal(lines[1].matchedBy, "current name");
  assert.equal(lines[2].providerId, 1);
  assert.equal(lines[2].matchedBy, "name");
  assert.equal(lines[3].providerId, 2);
  assert.match(lines[3].warnings[0], /Provider ID 999 is not in KatzDesk; matched by current name/);
});

test("blank cells keep what KatzDesk has; filled cells show old → new; the same value is no change", () => {
  const [l] = planProviderImport(
    rowsOf({ "Current Name": "STCS", Status: "active", "Dispatch Phone": "(956) 536-7846", "Dispatch Email": "ALANMCGEE@msn.com", Website: "stcs-service.com" }),
    PROVIDERS(),
  );
  assert.equal(l.status, "update");
  assert.deepEqual(
    l.changes.map((c) => [c.field, c.from, c.to]),
    [
      ["dispatchPhone", "956-536-7846", "(956) 536-7846"],
      ["website", null, "stcs-service.com"],
    ],
  );
  const [same] = planProviderImport(rowsOf({ "Current Name": "STCS", Status: "Active", "Dispatch Email": "alanmcgee@msn.com" }), PROVIDERS());
  assert.equal(same.status, "same");
  assert.equal(same.changes.length, 0);
  const [bad] = planProviderImport(rowsOf({ "Current Name": "STCS", Status: "Closed", Website: "not a site", "Dispatch Email": "nope" }), PROVIDERS());
  assert.equal(bad.status, "same");
  assert.equal(bad.warnings.length, 3);
});

test("the pin: an existing address on the same street and ZIP is updated and labelled Main; re-reading is no change", () => {
  const row = { "Current Name": "A-1 Restuarant Service", Name: "A-1 Restaurant Service", Address: "1407 Tulip Lane", City: "Odessa", State: "TX", ZIP: "79761", Latitude: "31.8722", Longitude: "-102.3741", "Match Type": "Exact", "Matched Address": "1407 TULIP LN, ODESSA, TX, 79761" };
  const [l] = planProviderImport(rowsOf(row), PROVIDERS());
  assert.equal(l.status, "update");
  assert.equal(l.pin.targetId, 11);
  assert.equal(l.pin.role, "main");
  assert.equal(l.pin.quality, "exact");
  assert.equal(l.changes[0].to, "A-1 Restaurant Service");
  const w = providerWrites([l]);
  assert.equal(w.updates.length, 1);
  assert.equal(w.updates[0].mainTargetId, 11);
  assert.equal(w.updates[0].addresses[0].label, "Main");
  assert.equal(w.updates[0].fields.name, "A-1 Restaurant Service");
  assert.match(w.updates[0].detail, /Name “A-1 Restuarant Service” → “A-1 Restaurant Service”/);
  // After Save: the provider has the new name and a Main address with the pin. The same file changes nothing.
  const after = PROVIDERS();
  after[0] = { ...after[0], name: "A-1 Restaurant Service", addresses: [{ id: 11, label: "Main", line1: "1407 Tulip Lane", city: "Odessa", state: "TX", zip: "79761", latitude: 31.8722, longitude: -102.3741, quality: "exact" }] };
  const [again] = planProviderImport(rowsOf(row), after);
  assert.equal(again.status, "same", again.reason);
  assert.equal(again.matchedBy, "name");
});

test("ZIP area pins are approximate; No_Match keeps the address without a pin", () => {
  const [zip] = planProviderImport(rowsOf({ "Current Name": "STCS", Address: "200 North Business 77", City: "Combes", State: "Texas", ZIP: "78535", Latitude: "26.24", Longitude: "-97.72", "Match Type": "ZIP area" }), PROVIDERS());
  assert.equal(zip.pin.quality, "approx");
  assert.equal(zip.pin.state, "TX");
  assert.equal(zip.pin.action, "add");
  const [none] = planProviderImport(rowsOf({ "Current Name": "STCS", Address: "200 North Business 77", City: "Combes", State: "TX", ZIP: "78535", "Match Type": "No_Match" }), PROVIDERS());
  assert.equal(none.pin.quality, null);
  assert.equal(none.status, "update");
  assert.equal(providerWrites([none]).updates[0].addresses[0].setPin, false);
});

test("merge: moves onto the kept row's provider with counts; re-reading after Save says already merged", () => {
  const rows = rowsOf(
    { "Current Name": "ETSC (EspressoTech Service Company)" },
    { "Current Name": "Espresso Tech", Name: "ETSC (EspressoTech Service Company)", "Merge Into": "etsc (espressotech service company)" },
  );
  const lines = planProviderImport(rows, PROVIDERS());
  assert.equal(lines[1].status, "merge", lines[1].reason);
  assert.deepEqual(lines[1].merge, {
    keeperId: 4, keeperName: "ETSC (EspressoTech Service Company)", keeperLine: 2, assignments: 2, overlapping: 1, contacts: 2, contactDupes: 0,
    addresses: 1, addressDupes: 0, coverage: 3, fills: ["Dispatch Phone"], contactPairs: [], addressPairs: [],
  });
  assert.equal(lines[0].status, "same");
  const w = providerWrites(lines);
  assert.equal(w.merges.length, 1);
  assert.equal(w.merges[0].duplicateId, 3);
  assert.equal(w.merges[0].keeperId, 4);
  assert.match(w.merges[0].detail, /moved 2 customer assignments \(1 already on/);
  const after = PROVIDERS().map((p) => (p.id === 3 ? { ...p, archived: true, mergedInto: 4 } : p));
  const again = planProviderImport(rows, after);
  assert.equal(again[1].status, "same");
  assert.match(again[1].reason, /Already merged/);
  assert.deepEqual(countProviderPlan(again), { update: 0, merge: 0, new: 0, same: 2, unmatched: 0, conflict: 0 });
});

test("merge validation: must name a kept row, never itself, no chains or cycles, not into a provider not in KatzDesk", () => {
  const missing = planProviderImport(rowsOf({ "Current Name": "Espresso Tech", "Merge Into": "Nobody" }), PROVIDERS());
  assert.equal(missing[0].status, "conflict");
  assert.match(missing[0].reason, /does not match the Name of a provider kept/);

  const self = planProviderImport(rowsOf({ "Current Name": "STCS" }, { Name: "STCS", "Merge Into": "STCS" }), PROVIDERS());
  assert.equal(self[1].status, "conflict");
  assert.match(self[1].reason, /merged into itself/);

  const chain = planProviderImport(
    rowsOf({ "Current Name": "ETSC (EspressoTech Service Company)" }, { "Current Name": "Espresso Tech", "Merge Into": "ETSC (EspressoTech Service Company)" }, { "Current Name": "STCS", "Merge Into": "Espresso Tech" }),
    PROVIDERS(),
  );
  assert.equal(chain[1].status, "merge");
  assert.equal(chain[2].status, "conflict");
  assert.match(chain[2].reason, /no chains/);

  const cycle = planProviderImport(rowsOf({ "Current Name": "STCS", "Merge Into": "Espresso Tech" }, { "Current Name": "Espresso Tech", "Merge Into": "STCS" }), PROVIDERS());
  assert.deepEqual(cycle.map((l) => l.status), ["conflict", "conflict"]);

  const intoNew = planProviderImport(rowsOf({ Name: "Brand New Co" }, { "Current Name": "STCS", "Merge Into": "Brand New Co" }), PROVIDERS(), { addNew: true });
  assert.equal(intoNew[1].status, "conflict");
  assert.match(intoNew[1].reason, /not in KatzDesk yet/);

  const keptAndMerged = planProviderImport(rowsOf({ "Current Name": "ETSC (EspressoTech Service Company)" }, { "Current Name": "Espresso Tech", "Merge Into": "ETSC (EspressoTech Service Company)" }, { "Current Name": "Espresso Tech", Status: "Active" }), PROVIDERS());
  assert.equal(keptAndMerged[1].status, "conflict");
  assert.equal(keptAndMerged[2].status, "conflict");

  const twoKeepers = planProviderImport(
    rowsOf({ "Current Name": "STCS" }, { "Current Name": "ETSC (EspressoTech Service Company)" }, { "Current Name": "Espresso Tech", "Merge Into": "STCS" }, { "Current Name": "Espresso Tech", "Merge Into": "ETSC (EspressoTech Service Company)" }),
    PROVIDERS(),
  );
  assert.deepEqual(twoKeepers.slice(2).map((l) => l.status), ["conflict", "conflict"]);
});

test("duplicates inside the file: a repeat is no change, a second address is another location, different values conflict", () => {
  const repeat = planProviderImport(
    rowsOf(
      { "Current Name": "STCS", Address: "200 North Business 77", City: "Combes", State: "TX", ZIP: "78535", Latitude: "26.24", Longitude: "-97.72", "Match Type": "Exact" },
      { "Provider ID": "2", Address: "200 N. Business 77", City: "Combes", State: "TX", ZIP: "78535" },
    ),
    PROVIDERS(),
  );
  assert.equal(repeat[0].status, "update");
  assert.equal(repeat[1].status, "same");
  assert.match(repeat[1].reason, /Same provider and address as line 2/);

  const twoPlaces = planProviderImport(
    rowsOf(
      { "Current Name": "STCS", Address: "200 North Business 77", City: "Combes", State: "TX", ZIP: "78535", Latitude: "26.24", Longitude: "-97.72", "Match Type": "Exact" },
      { "Current Name": "STCS", Address: "5 Main St", City: "Harlingen", State: "TX", ZIP: "78550", Latitude: "26.19", Longitude: "-97.69", "Match Type": "Non_Exact" },
    ),
    PROVIDERS(),
  );
  assert.equal(twoPlaces[1].status, "update");
  assert.equal(twoPlaces[1].pin.role, "extra");
  assert.equal(providerWrites(twoPlaces).updates[0].addresses.length, 2);

  const clash = planProviderImport(rowsOf({ "Current Name": "STCS", "Dispatch Phone": "111-111-1111" }, { Name: "STCS", "Dispatch Phone": "222-222-2222" }), PROVIDERS());
  assert.deepEqual(clash.map((l) => l.status), ["conflict", "conflict"]);
  assert.match(clash[0].reason, /different Dispatch Phone/);
});

test("renames: onto another provider's name is a conflict unless that provider is merged away in the same file", () => {
  const clash = planProviderImport(rowsOf({ "Current Name": "Espresso Tech", Name: "STCS" }), PROVIDERS());
  assert.equal(clash[0].status, "conflict");
  assert.match(clash[0].reason, /already named “STCS”/);
  const freed = planProviderImport(
    rowsOf({ "Current Name": "ETSC (EspressoTech Service Company)", Name: "Espresso Tech" }, { "Current Name": "Espresso Tech", "Merge Into": "Espresso Tech" }),
    PROVIDERS(),
  );
  assert.equal(freed[0].status, "update");
  assert.equal(freed[1].status, "merge");
  const twoAlike = planProviderImport(rowsOf({ "Current Name": "STCS", Name: "Same Name" }, { "Current Name": "Espresso Tech", Name: "same name" }), PROVIDERS());
  assert.deepEqual(twoAlike.map((l) => l.status), ["conflict", "conflict"]);
});

test("unmatched rows are added only with a Name and Add new providers ticked; archived providers are not updated", () => {
  const rows = rowsOf(
    { Name: "Brand New Co", Status: "Prospect", Address: "1 Main St", City: "Austin", State: "TX", ZIP: "78701", Latitude: "30.26", Longitude: "-97.74", "Match Type": "Exact" },
    { "Current Name": "Ghost Shop" },
    { "Current Name": "Old Closed Co", Status: "Active" },
  );
  const off = planProviderImport(rows, PROVIDERS());
  assert.deepEqual(off.map((l) => l.status), ["unmatched", "unmatched", "unmatched"]);
  assert.equal(off[0].canAdd, true);
  assert.equal(off[1].canAdd, false);
  assert.match(off[2].reason, /removed from Out of Network/);
  const on = planProviderImport(rows, PROVIDERS(), { addNew: true });
  assert.deepEqual(on.map((l) => l.status), ["new", "unmatched", "unmatched"]);
  const w = providerWrites(on);
  assert.equal(w.creates.length, 1);
  assert.equal(w.creates[0].name, "Brand New Co");
  assert.equal(w.creates[0].fields.status, "Prospect");
  assert.equal(w.creates[0].addresses[0].label, "Main");
  assert.equal(w.creates[0].addresses[0].quality, "exact");
});

test("street compare: punctuation and common words do not matter; the ZIP must agree", () => {
  assert.equal(streetKey("2100 Concord Blvd. Suite K"), streetKey("2100 Concord Boulevard Ste K"));
  assert.ok(sameAddress({ line1: "1407 Tulip Ln.", zip: "79761" }, { line1: "1407 Tulip Lane", zip: "79761-1234" }));
  assert.ok(!sameAddress({ line1: "1407 Tulip Ln", zip: "79761" }, { line1: "1407 Tulip Ln", zip: "79762" }));
  assert.ok(sameAddress({ line1: "9 Elm St", city: "St Louis" }, { line1: "9 Elm Street", city: "st louis" }));
});

test("Merge Into may also use the keeper's current name when its row renames it", () => {
  const lines = planProviderImport(
    rowsOf({ "Current Name": "ETSC (EspressoTech Service Company)", Name: "ETSC" }, { "Current Name": "Espresso Tech", "Merge Into": "ETSC (EspressoTech Service Company)" }),
    PROVIDERS(),
  );
  assert.equal(lines[1].status, "merge", lines[1].reason);
  assert.equal(lines[1].merge.keeperId, 4);
  assert.equal(lines[0].status, "update");
});

test("an address with no street on the same ZIP is the same place: the import fills in the street", () => {
  const providers = PROVIDERS();
  providers[1] = { ...providers[1], addresses: [{ id: 21, label: null, line1: null, city: "Combes", state: "TX", zip: "78535", latitude: null, longitude: null, quality: null }] };
  const [l] = planProviderImport(rowsOf({ "Current Name": "STCS", Address: "200 North Business 77", City: "Combes", State: "TX", ZIP: "78535", "Match Type": "No_Match" }), providers);
  assert.equal(l.pin.targetId, 21);
  assert.equal(l.pin.action, "update");
  assert.ok(sameAddress({ line1: null, city: "Combes", zip: "78535" }, { line1: "200 North Business 77", city: "Combes", zip: "78535" }));
  assert.ok(!sameAddress({ line1: null, city: "Harlingen", zip: "78535" }, { line1: "200 North Business 77", city: "Combes", zip: "78535" }));
});

test("a Main address with a street that is another place is kept; the file's address is a new Main row (no mixed address)", () => {
  const providers = PROVIDERS();
  providers[1] = { ...providers[1], addresses: [{ id: 21, label: "Main", line1: "100 Old Rd", line2: "Suite 4", city: "Austin", state: "TX", zip: "78701", latitude: 30.27, longitude: -97.74, quality: "exact" }] };
  const [l] = planProviderImport(rowsOf({ "Current Name": "STCS", Address: "200 New St", City: "Dallas", State: "TX", Latitude: "32.78", Longitude: "-96.8", "Match Type": "Non_Exact" }), providers);
  assert.equal(l.pin.action, "add");
  assert.equal(l.pin.targetId, null);
  const w = providerWrites([l]).updates[0];
  assert.equal(w.mainTargetId, -1, "the old row's Main label is cleared");
  assert.equal(w.addresses[0].label, "Main");
  // A Main row with no street yet is filled in, whole: nothing of the old city or ZIP is kept.
  providers[1] = { ...providers[1], addresses: [{ id: 22, label: "Main", line1: null, line2: null, city: "Harlingen", state: "TX", zip: "78550", latitude: null, longitude: null, quality: null }] };
  const [fill] = planProviderImport(rowsOf({ "Current Name": "STCS", Address: "200 North Business 77", City: "Combes", State: "TX", "Match Type": "No_Match" }), providers);
  assert.equal(fill.pin.targetId, 22);
  assert.equal(fill.pin.replace, true);
  const a = providerWrites([fill]).updates[0].addresses[0];
  assert.equal(a.replace, true);
  assert.equal(a.zip, null);
  // A street that changes on a matched row clears the old suite line.
  providers[1] = { ...providers[1], addresses: [{ id: 23, label: "Main", line1: "505 Meadowland Dr", line2: "Unit 104", city: "Hillsborough", state: "NC", zip: "27278", latitude: null, longitude: null, quality: null }] };
  const [unit] = planProviderImport(rowsOf({ "Current Name": "STCS", Address: "505 Meadowland Dr Unit 101", City: "Hillsborough", State: "NC", ZIP: "27278", "Match Type": "No_Match" }), providers);
  assert.equal(unit.pin.targetId, 23);
  assert.equal(unit.pin.clearLine2, true);
});

test("street compare: direction letters and other street names are not the same place", () => {
  assert.ok(!sameAddress({ line1: "100 N Main St", zip: "78701" }, { line1: "100 N Lamar Blvd", zip: "78701" }));
  assert.ok(!sameAddress({ line1: "100 E 5th St", zip: "78701" }, { line1: "100 W 5th St", zip: "78701" }));
  assert.ok(sameAddress({ line1: "100 Main St Ste 4", zip: "78701" }, { line1: "100 Main Street", zip: "78701" }));
  assert.ok(sameAddress({ line1: "483 S Kirkwood Rd Ste 254", zip: "63122" }, { line1: "483 Kirkwood Rd", zip: "63122" }));
  assert.ok(sameAddress({ line1: "9 Progress Pkwy", zip: "63084" }, { line1: "9 Progress Dr", zip: "63084" }));
  assert.ok(sameAddress({ line1: "730 Main St PMB358", zip: "29582" }, { line1: "730 Main St PMB 358", zip: "29582" }), "a unit written as one word");
  assert.ok(sameAddress({ line1: "505 Meadowlands Dr Unit 101", zip: "27278" }, { line1: "505 Meadowland Dr Unit 101", zip: "27278" }), "a plural s slip");
  const lines = planProviderImport(
    rowsOf(
      { "Current Name": "STCS", Address: "100 N Main St", City: "Austin", State: "TX", ZIP: "78701", Latitude: "30.27", Longitude: "-97.74", "Match Type": "Exact" },
      { "Current Name": "STCS", Address: "100 N Lamar Blvd", City: "Austin", State: "TX", ZIP: "78701", Latitude: "30.28", Longitude: "-97.75", "Match Type": "Exact" },
    ),
    PROVIDERS(),
  );
  assert.equal(lines[1].status, "update", lines[1].reason);
  assert.equal(lines[1].pin.role, "extra");
});

test("a Provider ID that names a different provider than the Current Name is a conflict", () => {
  const [l] = planProviderImport(rowsOf({ "Provider ID": "2", "Current Name": "Espresso Tech", Name: "Espresso Tech LLC", "Dispatch Phone": "333-333-3333" }), PROVIDERS());
  assert.equal(l.status, "conflict");
  assert.match(l.reason, /Provider ID 2 is “STCS”, not “Espresso Tech”/);
  assert.equal(providerWrites([l]).updates.length, 0);
  // Already renamed by an earlier Save: the cleaned Name is the provider's name, so it is not a clash.
  const [ok] = planProviderImport(rowsOf({ "Provider ID": "2", "Current Name": "S.T.C.S.", Name: "STCS" }), PROVIDERS());
  assert.notEqual(ok.status, "conflict");
});

test("after a merge: the keeper renamed to the duplicate's name reads as already merged; the merged name is never added again", () => {
  const before = [provider({ id: 1, name: "ABC Refrig" }), provider({ id: 2, name: "ABC Refrigeration" })];
  const rows = rowsOf({ "Current Name": "ABC Refrig", Name: "ABC Refrigeration" }, { "Current Name": "ABC Refrigeration", Name: "ABC Refrigeration", "Merge Into": "ABC Refrigeration" });
  const first = planProviderImport(rows, before);
  assert.deepEqual(first.map((l) => l.status), ["update", "merge"]);
  const after = [provider({ id: 1, name: "ABC Refrigeration" }), provider({ id: 2, name: "ABC Refrigeration", archived: true, mergedInto: 1 })];
  const again = planProviderImport(rows, after);
  assert.deepEqual(again.map((l) => l.status), ["same", "same"]);
  assert.match(again[1].reason, /Already merged into “ABC Refrigeration”/);
  const gone = [provider({ id: 1, name: "ABC" }), provider({ id: 2, name: "ABC Inc", archived: true, mergedInto: 1 })];
  const [relisted] = planProviderImport(rowsOf({ Name: "ABC Inc", "Dispatch Phone": "555-555-5555" }), gone, { addNew: true });
  assert.equal(relisted.status, "unmatched");
  assert.match(relisted.reason, /merged into “ABC”/);
});

test("merge: the keeper's copies of the duplicate's contacts and addresses are counted and dropped; blank fields filled", () => {
  const providers = [
    provider({ id: 1, name: "Lone Star Espresso", people: [{ id: 101, name: "Bob Smith", role: null, phone: "713-555-0100", email: "bob@lonestar.com" }],
      addresses: [{ id: 11, label: "Main", line1: "1407 Tulip Ln", city: "Odessa", state: "TX", zip: "79761", latitude: null, longitude: null, quality: null }] }),
    provider({ id: 2, name: "Lone Star Espresso LLC", contacts: 2, coverage: "TX: Houston", texts: { notes: "Dup notes" },
      people: [{ id: 201, name: "bob  smith", role: "Owner", phone: "(713) 555-0100", email: "BOB@lonestar.com" }, { id: 202, name: "Ann", role: null, phone: null, email: "ann@x.com" }],
      addresses: [{ id: 21, label: null, line1: "1407 Tulip Ln.", city: "Odessa", state: "TX", zip: "79761", latitude: 31.86, longitude: -102.37, quality: "exact" }, { id: 22, label: null, line1: "5 Other St", city: "Odessa", state: "TX", zip: "79761", latitude: null, longitude: null, quality: null }] }),
  ];
  const lines = planProviderImport(rowsOf({ "Current Name": "Lone Star Espresso" }, { "Current Name": "Lone Star Espresso LLC", "Merge Into": "Lone Star Espresso" }), providers);
  const m = lines[1].merge;
  assert.equal(m.contactDupes, 1);
  assert.deepEqual(m.contactPairs, [[201, 101]]);
  assert.equal(m.addressDupes, 1);
  assert.deepEqual(m.addressPairs, [[21, 11]]);
  assert.deepEqual(m.fills, ["Coverage", "Notes"]);
  const w = providerWrites(lines).merges[0];
  assert.deepEqual(w.addressPairs, [[21, 11]]);
  assert.match(w.detail, /2 contacts \(1 already on “Lone Star Espresso”, the copy dropped\)/);
  assert.match(w.detail, /filled the blank Coverage, Notes/);
});
