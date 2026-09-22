import fs from "node:fs";
import * as XLSX from "xlsx";
import catalog from "../src/lib/ops/directory-equipment.json" with { type: "json" };
import customers from "../src/lib/ops/directory-customers.json" with { type: "json" };
import {
  matchAccount,
  matchCatalogModel,
  parseSerial,
  parseInstallDate,
  mapOwnership,
} from "../src/lib/ops/account-equip.ts";

const buf = fs.readFileSync("/workspace/attachments/Equipment List.xlsx");
const wb = XLSX.read(buf, { type: "buffer", cellDates: true, raw: false });
const sheet = wb.Sheets[wb.SheetNames[0]];
const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
const header = matrix[0].map((h) => String(h));
console.log("headers", header);

const accounts = customers.map((name, id) => ({ id: id + 1, name }));
let matched = 0;
let reviewWalk = 0;
let reviewAcct = 0;
let reviewModel = 0;
let both = 0;
const samples = { matched: [], walk: [], model: [] };

for (let i = 1; i < matrix.length; i++) {
  const rec = {
    customer: String(matrix[i][0] ?? "").trim(),
    equipmentName: String(matrix[i][1] ?? "").trim(),
    model: String(matrix[i][2] ?? "").trim(),
    serial: String(matrix[i][3] ?? "").trim(),
  };
  if (!rec.customer && !rec.equipmentName && !rec.model) continue;
  const acct = matchAccount(rec.customer, accounts);
  const cat = matchCatalogModel(rec.equipmentName, rec.model, catalog);
  const okAcct = acct.status === "matched";
  const okModel = cat.status === "matched";
  if (acct.status === "walk-in") reviewWalk += 1;
  else if (!okAcct) reviewAcct += 1;
  if (!okModel) reviewModel += 1;
  if (okAcct && okModel) {
    matched += 1;
    if (samples.matched.length < 3) {
      samples.matched.push({
        customer: acct.account.name,
        equipmentName: rec.equipmentName,
        fileModel: rec.model,
        catalog: cat.catalogModel,
        serial: parseSerial(rec.serial),
        date: parseInstallDate(String(matrix[i][4] ?? "")),
        ownership: mapOwnership(String(matrix[i][6] ?? "")).value,
      });
    }
  } else both += 1;
  if (acct.status === "walk-in" && samples.walk.length < 2) {
    samples.walk.push({ customer: rec.customer, equipmentName: rec.equipmentName, model: rec.model, catalog: cat.catalogModel, modelStatus: cat.status });
  }
  if (!okModel && acct.status !== "walk-in" && samples.model.length < 2) {
    samples.model.push({ customer: rec.customer, equipmentName: rec.equipmentName, model: rec.model, reason: cat.reason, candidates: cat.candidates.slice(0, 3) });
  }
}

console.log(JSON.stringify({ rows: matrix.length - 1, matched, reviewWalk, reviewAcct, reviewModel, needsReview: both, samples }, null, 2));
