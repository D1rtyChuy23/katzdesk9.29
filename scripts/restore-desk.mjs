import { PGlite } from "@electric-sql/pglite";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const dataDir = resolve("/workspace/data/desk");
mkdirSync(dataDir, { recursive: true });
const pg = new PGlite(dataDir);
await pg.waitReady;
await pg.exec(
  "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())",
);

const migDir = resolve("/workspace/migrations");
const done = new Set(
  (await pg.query("select name from _migrations")).rows.map((r) => r.name),
);
for (const name of readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort()) {
  if (done.has(name)) continue;
  const text = readFileSync(resolve(migDir, name), "utf8");
  await pg.exec(text);
  await pg.query("insert into _migrations (name) values ($1)", [name]);
  console.log("migrated", name);
}

function cleanDate(v) {
  if (v == null || v === "") return null;
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

async function insertMany(table, cols, rows, dateCols = []) {
  const dates = new Set(dateCols);
  const chunk = 20;
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const values = [];
    const placeholders = part.map((row, ri) => {
      const start = ri * cols.length;
      cols.forEach((col, ci) => {
        values.push(dates.has(col) ? cleanDate(row[ci]) : row[ci]);
      });
      return `(${cols.map((_, ci) => `$${start + ci + 1}`).join(",")})`;
    });
    await pg.query(
      `insert into ${table} (${cols.join(",")}) values ${placeholders.join(",")}`,
      values,
    );
  }
}

async function insertNames(table, list) {
  const raw = Array.isArray(list) ? list : list.default || [];
  for (const item of raw) {
    const name = String(item ?? "").trim();
    if (!name) continue;
    await pg.query(
      `insert into ${table} (name) select $1 where not exists (select 1 from ${table} where lower(name) = lower($1))`,
      [name],
    );
  }
}

const jobs = (await pg.query("select count(*)::int n from service_jobs")).rows[0].n;
if (jobs > 0) {
  console.log("already has", jobs, "jobs — skip ops seed");
} else {
  const seed = JSON.parse(readFileSync("/workspace/src/lib/ops/seed-data.json", "utf8"));
  const jobCols = [
    "kind","call_id","contact","phone","received","customer","equipment","issue",
    "call_type","phone_resolved","status","technician","wo","scheduled","notes","done",
  ];
  const jobRow = (j) => [
    j.kind, j.callId, j.contact, j.phone, j.received, j.customer, j.equipment, j.issue,
    j.type, j.phoneRes, j.status, j.tech, j.wo, j.scheduled, j.notes, j.done,
  ];
  await insertMany("service_jobs", jobCols, [...seed.service.map(jobRow), ...seed.tlc.map(jobRow)], ["received","scheduled"]);
  await insertMany("pm_jobs",
    ["customer","received","equipment","style","projected","parts_status","status","technician","notes","done"],
    seed.pms.map((p) => [p.customer,p.received,p.equipment,p.style,p.projected,p.parts,p.status,p.tech,p.notes,p.done]),
    ["received","projected"],
  );
  await insertMany("modules",
    ["module_id","platform","module_type","status","wo","location","date_in","date_ready","technician","notes"],
    seed.modules.map((m) => [m.moduleId,m.platform,m.moduleType,m.status,m.wo,m.location,m.dateIn,m.dateReady,m.tech,m.notes]),
    ["date_in","date_ready"],
  );
  await insertMany("deals",
    ["customer","producer","account_type","date_of_deal","equipment","amount","good_to_order","ordered","eta","terms","invoice","completion","notes"],
    seed.deals.map((d) => [d.customer,d.producer,d.accountType,d.dateOfDeal,d.equipment,d.amount,d.goodToOrder,d.ordered,d.eta,d.terms,d.invoice,d.completion === "✔" ? "complete" : d.completion === "X" ? "fell" : null,d.notes]),
    ["date_of_deal","eta"],
  );
  await insertMany("installs",
    ["received","customer","equipment","equip_status","install_date","technician","wo","reqs_ready","notes","account_rep","payment_status","complete"],
    seed.installs.map((i) => [i.received,i.customer,i.equipment,i.equipStatus,i.installDate,i.tech,i.wo,i.reqsReady,i.notes,i.rep,i.payment,i.complete]),
    ["received","install_date"],
  );
  console.log("ops rows inserted");
}

const customers = JSON.parse(readFileSync("/workspace/src/lib/ops/directory-customers.json", "utf8"));
const equipment = JSON.parse(readFileSync("/workspace/src/lib/ops/directory-equipment.json", "utf8"));
await insertNames("directory_customers", customers);
await insertNames("directory_equipment", equipment);
await pg.query(`
  insert into directory_customers (name)
  select distinct trim(customer) from (
    select customer from installs
    union select customer from deals
    union select customer from service_jobs
    union select customer from pm_jobs
  ) t
  where coalesce(trim(customer), '') <> ''
    and not exists (select 1 from directory_customers d where lower(d.name) = lower(trim(t.customer)))
`);

const providers = JSON.parse(readFileSync("/workspace/src/lib/ops/seed-network-providers.json", "utf8"));
for (const p of providers) {
  await pg.query(
    `insert into network_providers (
       name, status, dispatch_phone, dispatch_email, secondary_phone, secondary_email,
       response_time, standard_rate, after_hours_rate, travel_policy, equipment_serviced,
       coverage, contacts, pm_pricing, parts_stocking, notes, last_updated
     )
     select $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
     where not exists (select 1 from network_providers where lower(name) = lower($1))`,
    [p.name,p.status,p.dispatchPhone,p.dispatchEmail,p.secondaryPhone,p.secondaryEmail,p.responseTime,p.standardRate,p.afterHoursRate,p.travelPolicy,p.equipmentServiced,p.coverage,p.contacts,p.pmPricing,p.partsStocking,p.notes,p.lastUpdated],
  );
}
const accounts = JSON.parse(readFileSync("/workspace/src/lib/ops/seed-network-accounts.json", "utf8"));
const ids = (await pg.query("select id, name from network_providers")).rows;
const byName = new Map(ids.map((r) => [r.name.trim().toLowerCase(), r.id]));
for (const a of accounts) {
  await pg.query(
    `insert into directory_customers (name) select $1 where not exists (select 1 from directory_customers where lower(name)=lower($1))`,
    [a.name],
  );
  await pg.query(
    `insert into network_accounts (customer, email, contact, phone, address, city, state, zip, equipment, ownership, region)
     select $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
     where not exists (select 1 from network_accounts where lower(customer)=lower($1))`,
    [a.name,a.email,a.contact,a.phone,a.address,a.city,a.state,a.zip,a.equipment,a.ownership,a.region],
  );
  for (const [nm, role] of [[a.primary,"primary"],[a.secondary,"secondary"]]) {
    if (!nm) continue;
    const pid = byName.get(String(nm).trim().toLowerCase());
    if (!pid) continue;
    await pg.query(
      `insert into customer_providers (customer, provider_id, role)
       select $1,$2,$3 where not exists (select 1 from customer_providers where provider_id=$2 and lower(customer)=lower($1))`,
      [a.name, pid, role],
    );
  }
}

for (const [k, v] of [
  ["ops", "v2"],
  ["assets", "v1"],
  ["tea_urgency", "v1"],
  ["recipes_customers", "v1"],
  ["directory", "v3"],
  ["network", "v1"],
  ["network-locations", "v3"],
  ["network-people", "v1"],
  ["customer-identity", "v1"],
]) {
  await pg.query("insert into seed_meta (k, v) values ($1,$2) on conflict (k) do update set v = excluded.v", [k, v]);
}

const summary = await pg.query(`
  select
    (select count(*)::int from service_jobs) as jobs,
    (select count(*)::int from pm_jobs) as pms,
    (select count(*)::int from installs) as installs,
    (select count(*)::int from deals) as deals,
    (select count(*)::int from directory_customers) as customers,
    (select count(*)::int from network_providers) as providers
`);
console.log("restored", summary.rows[0]);
await pg.close();
