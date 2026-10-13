import assert from "node:assert/strict";
import { listedEquipment, matchModel, rewriteEquipmentName, splitEquipment } from "../src/lib/ops/equipment.ts";

const catalog = [
  "Blendtec Rapid Rinse Station",
  "Blendtec Stealth 885, 90 oz Commercial Food Blender, 3.8 HP, Variable Speed",
  "Bunn Axiom Twin APS",
  "Bunn Axiom-15-3, 1L/2U",
  "Bunn Axiom-DV-APS",
  "Bunn ITCB-DV, 29\" w/Flip Tray",
  "Bunn TB3",
  "Eversys E'Fridge / Classic",
  "Faema E61 Jubile A/2",
  "La Marzocco GB/5 S 3 Group AV",
  "La Marzocco Linea Classic S 2 Group AV",
  "La Marzocco Linea PB 3 Group AV",
  "La Marzocco Linea PB X 3 Group ABR",
  "La Marzocco Swift Dual-Hopper Espresso Grinder",
  "Mahlkönig E65S",
];

assert.deepEqual(
  listedEquipment("Bunn Axiom-15-3, 1L/2U", catalog),
  ["Bunn Axiom-15-3, 1L/2U"],
  "catalog comma name stays one chip",
);
assert.deepEqual(
  listedEquipment("La Marzocco GB/5 S 3 Group AV", catalog),
  ["La Marzocco GB/5 S 3 Group AV"],
  "catalog slash name stays one chip",
);
assert.deepEqual(
  listedEquipment("Eversys E'Fridge / Classic", catalog),
  ["Eversys E'Fridge / Classic"],
  "catalog spaced slash stays one chip",
);
assert.deepEqual(
  listedEquipment("Faema E61 Jubile A/2", catalog),
  ["Faema E61 Jubile A/2"],
);
assert.deepEqual(
  listedEquipment("La Marzocco GB/5 S 3 Group AV", []),
  ["La Marzocco GB/5 S 3 Group AV"],
  "empty catalog still does not split GB/5",
);
assert.deepEqual(
  splitEquipment("La Marzocco GB/5 S 3 Group AV"),
  ["La Marzocco GB/5 S 3 Group AV"],
);

assert.equal(matchModel("axiom aps", catalog), "Bunn Axiom-APS");
assert.equal(matchModel("bunn itcb", catalog), "Bunn ITCB");
assert.equal(matchModel("TB3", catalog), "Bunn TB3");
assert.equal(matchModel("ITCB", []), "Bunn ITCB");

assert.deepEqual(listedEquipment("axiom aps", catalog), ["Bunn Axiom-APS"]);
assert.deepEqual(listedEquipment("bunn itcb", catalog), ["Bunn ITCB"]);
assert.deepEqual(listedEquipment("TB3", catalog), ["Bunn TB3"]);

assert.deepEqual(
  listedEquipment(
    "La Marzocco Linea Classic S 2 Group AV/ La Marzocco Swift Dual-Hopper Espresso Grinder/ Bunn Axiom-APS",
    catalog,
  ),
  [
    "La Marzocco Linea Classic S 2 Group AV",
    "La Marzocco Swift Dual-Hopper Espresso Grinder",
    "Bunn Axiom-APS",
  ],
);

assert.deepEqual(
  listedEquipment(
    "La Marzocco GB/5 S 3 Group AV/La Marzocco Linea PB 3 Group AV/La Marzocco Linea PB X 3 Group ABR/Mahlkönig E65S",
    catalog,
  ),
  [
    "La Marzocco GB/5 S 3 Group AV",
    "La Marzocco Linea PB 3 Group AV",
    "La Marzocco Linea PB X 3 Group ABR",
    "Mahlkönig E65S",
  ],
  "slash between catalog names does not split GB/5",
);

assert.deepEqual(
  listedEquipment(
    "La Marzocco GB/5 S 3 Group AV, La Marzocco Linea PB 3 Group AV, La Marzocco Linea PB X 3 Group ABR, Mahlkönig E65S",
    catalog,
  ),
  [
    "La Marzocco GB/5 S 3 Group AV",
    "La Marzocco Linea PB 3 Group AV",
    "La Marzocco Linea PB X 3 Group ABR",
    "Mahlkönig E65S",
  ],
  "adding several catalog names keeps each full name",
);

assert.deepEqual(
  listedEquipment("Invicta 3GR, Robur S E, Puqpress, TB3", catalog),
  ["Invicta 3GR", "Robur S E", "Puqpress", "Bunn TB3"],
);

assert.equal(
  rewriteEquipmentName("La Marzocco GB/5 S 3 Group AV", "La Marzocco GB/5 S 3 Group AV", "LM GB/5 3GR", catalog),
  "LM GB/5 3GR",
);
assert.equal(
  rewriteEquipmentName(
    "La Marzocco GB/5 S 3 Group AV\nMahlkönig E65S",
    "La Marzocco GB/5 S 3 Group AV",
    "LM GB/5 3GR",
    catalog,
  ),
  "LM GB/5 3GR\nMahlkönig E65S",
);

console.log("equipment names ok");

// A model suffix stays with its machine: "Bunn ITCB-DV" is one machine, never "Bunn ITCB" + "-DV".
{
  const cat = ["Bunn ITCB", "Bunn ITCB NS", "Bunn G9-2T", "Eversys Cameo c'2s"];
  assert.deepEqual(listedEquipment("Bunn G9-2T\nBunn ITCB-DV\nEversys Cameo C'2s", cat), ["Bunn G9-2T", "Bunn ITCB", "Eversys Cameo c'2s"]);
  assert.deepEqual(listedEquipment("Bunn ITCB\n-DV", cat), ["Bunn ITCB"]);
}
