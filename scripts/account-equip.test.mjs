import assert from "node:assert/strict";
import catalog from "../src/lib/ops/directory-equipment.json" with { type: "json" };
import {
  matchAccount,
  matchCatalogModel,
  matchExistingUnit,
  parseSerial,
  parseInstallDate,
  mapOwnership,
  compactEquip,
} from "../src/lib/ops/account-equip.ts";

const accounts = [
  { id: 1, name: "First Market" },
  { id: 2, name: "Steak 48 Houston" },
  { id: 3, name: "Walk - In" },
  { id: 4, name: "Christopher's World Grille" },
  { id: 5, name: "Walk - In:Black Rock Coffee Bar" },
];

{
  const hit = matchAccount("first  market", accounts);
  assert.equal(hit.status, "matched");
  assert.equal(hit.account?.name, "First Market");
}
{
  const hit = matchAccount("First-Market", accounts);
  assert.equal(hit.status, "matched");
}
{
  const hit = matchAccount("Walk - In", accounts);
  assert.equal(hit.status, "walk-in");
  assert.equal(hit.account, null);
}
{
  const hit = matchAccount("Walk-In", accounts);
  assert.equal(hit.status, "walk-in");
}
{
  const hit = matchAccount("Nobody Cafe", accounts);
  assert.equal(hit.status, "unmatched");
}
{
  const hit = matchAccount("Walk - In:Black Rock Coffee Bar", accounts);
  assert.equal(hit.status, "matched");
  assert.equal(hit.account?.name, "Walk - In:Black Rock Coffee Bar");
}

function model(name, fileModel) {
  return matchCatalogModel(name, fileModel, catalog);
}

{
  const hit = model("ITCB Combo Brewer", "Bunn ITCB Combo Brewer");
  assert.equal(hit.status, "matched", hit.reason);
  assert.match(hit.catalogModel ?? "", /ITCB/i);
  assert.doesNotMatch(hit.catalogModel ?? "", /ITB Dual|ITB-LP/i);
}
{
  const hit = model("Cameo c'2s", "Eversys Cameo c'2s");
  assert.equal(hit.status, "matched", hit.reason);
  assert.match(hit.catalogModel ?? "", /c['’]?2s/i);
  assert.doesNotMatch(hit.catalogModel ?? "", /c['’]?2m/i);
}
{
  const hit = model("Eversys Cameo (Downstairs)", "Eversys Cameo c'2s");
  assert.equal(hit.status, "matched", hit.reason);
  assert.match(hit.catalogModel ?? "", /c['’]?2s/i);
}
{
  const hit = model("Cameo", "Eversys Cameo");
  assert.equal(hit.status, "ambiguous", `Cameo alone should review, got ${hit.catalogModel}`);
}
{
  const hit = model("La Marzocco Linea Mini", "La Marzocco Linea Mini");
  assert.equal(hit.status, "matched");
  assert.equal(hit.catalogModel, "La Marzocco Linea Mini");
}
{
  const hit = model("Bunn Axiom-APS Brewer", "Bunn Axiom Brewer");
  assert.equal(hit.status, "ambiguous", `Axiom should review, got ${hit.catalogModel}`);
}
{
  const hit = model("GR2.2 Dual Portion Grinder", "Fetco GR Series");
  assert.equal(hit.status, "matched", hit.reason);
  assert.match(hit.catalogModel ?? "", /GR2\.2/);
}
{
  const hit = model("Bunn TB3 Tea Brewer #1", "Bunn TB3 Tea Brewer #1");
  assert.equal(hit.status, "matched", hit.reason);
  assert.equal(hit.catalogModel, "Bunn TB3");
}
{
  const hit = model("Bunn ITCB (Front Kitchen)", "Bunn ITB Tea Brewer #1");
  assert.equal(hit.status, "ambiguous", `ITCB name vs ITB model should review, got ${hit.catalogModel} (${hit.reason})`);
}
{
  const hit = model("La Marzocco Swift Grinder", "La Marzocco Swift Grinder");
  assert.equal(hit.status, "matched", hit.reason);
  assert.match(hit.catalogModel ?? "", /Swift/i);
}
{
  const hit = model("Bravilor Sego 12", "Bravilor Sego 12");
  assert.equal(hit.status, "matched", hit.reason);
  assert.match(hit.catalogModel ?? "", /Sego 12/i);
}
{
  const hit = model("Franke A800", "Espresso Machine");
  assert.equal(hit.status, "unmatched");
}
{
  const hit = model("Bunn ITCB Combo Brewer", "Bunn ITCB Combo Brewer");
  assert.ok(catalog.includes(hit.catalogModel), "must attach a real catalog name, not invent Bunn ITCB");
}

assert.equal(parseSerial("N/A"), null);
assert.equal(parseSerial("n/a"), null);
assert.equal(parseSerial("NA"), null);
assert.equal(parseSerial("Na"), null);
assert.equal(parseSerial("Not available"), null);
assert.equal(parseSerial(""), null);
assert.equal(parseSerial("  "), null);
assert.equal(parseSerial("00998200 21173 C0021"), "00998200 21173 C0021");
assert.equal(parseSerial("ITCB138218"), "ITCB138218");

assert.equal(parseInstallDate("2018-12-01"), "2018-12-01");
assert.equal(parseInstallDate("N/A"), null);
assert.equal(parseInstallDate("Mullet was original owner"), null);
assert.equal(parseInstallDate("n/a"), null);
assert.equal(parseInstallDate(""), null);
assert.equal(parseInstallDate("04/15/2015"), "2015-04-15");

assert.equal(mapOwnership("Loaned").value, "Loaned");
assert.equal(mapOwnership("Owned - Purchased from Katz").value, "Owned - Purchased from Katz");
assert.equal(mapOwnership("Owned - Purchased from 3rd Party").value, "Owned - Purchased from 3rd Party");
assert.equal(mapOwnership("Owned").value, "Owned");
assert.equal(mapOwnership("Lease").value, "Lease");
assert.equal(mapOwnership("").status, "blank");
assert.equal(mapOwnership("mystery").status, "unknown");
assert.equal(mapOwnership("mystery").value, null);

{
  const existing = [
    {
      id: 10,
      customer: "First Market",
      catalogModel: "Bunn ITCB-DV, 29\" w/Flip Tray",
      equipmentName: "ITCB Combo Brewer",
      serial: "ITCB138218",
      serialKey: "itcb138218",
    },
    {
      id: 11,
      customer: "Steak 48 Houston",
      catalogModel: "Eversys Cameo c'2s - 2 Step Classic",
      equipmentName: "Eversys Cameo (Downstairs)",
      serial: "00998200 21173 C0021",
      serialKey: "0099820021173c0021",
    },
  ];
  const update = matchExistingUnit({
    customer: "First Market",
    catalogModel: "Bunn ITCB-DV, 29\" w/Flip Tray",
    equipmentName: "ITCB Combo Brewer",
    serial: "ITCB138218",
    existing,
  });
  assert.equal(update.action, "update");
  assert.equal(update.existingId, 10);

  const steal = matchExistingUnit({
    customer: "First Market",
    catalogModel: "Eversys Cameo c'2s - 2 Step Classic",
    equipmentName: "Cameo c'2s",
    serial: "00998200 21173 C0021",
    existing,
  });
  assert.equal(steal.action, "review");
  assert.equal(steal.foreignAccount, "Steak 48 Houston");

  const addNamed = matchExistingUnit({
    customer: "First Market",
    catalogModel: "Bunn G9-2 HD Dual Portion Grinder",
    equipmentName: "Bunn G9-2T (Front Kitchen)",
    serial: null,
    existing,
  });
  assert.equal(addNamed.action, "add");

  const updateNoSerial = matchExistingUnit({
    customer: "First Market",
    catalogModel: "Bunn ITCB-DV, 29\" w/Flip Tray",
    equipmentName: "ITCB Combo Brewer",
    serial: null,
    existing: [
      {
        id: 12,
        customer: "First Market",
        catalogModel: "Bunn ITCB-DV, 29\" w/Flip Tray",
        equipmentName: "ITCB Combo Brewer",
        serial: null,
        serialKey: null,
      },
    ],
  });
  assert.equal(updateNoSerial.action, "update");
}

assert.ok(compactEquip("Bunn ITCB-DV, 29\" w/Flip Tray").includes("itcb"));
assert.equal(compactEquip("GR2.2 Dual"), "gr22 dual");

console.log("account-equip.test.mjs ok");
