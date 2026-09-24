import { getSql } from "@/lib/db";
import type { Sql } from "@/lib/db";
import seedJson from "./seed-data.json";
import assetsJson from "./seed-assets.json";
import directoryCustomersJson from "./directory-customers.json";
import directoryEquipmentJson from "./directory-equipment.json";
import networkProvidersJson from "./seed-network-providers.json";
import networkAccountsJson from "./seed-network-accounts.json";
import { findDuplicateLocation, normalizeCity, normalizeState, normalizeZip, parseContactBlob, parseCoverageLocations } from "./network";
import { retargetCustomer } from "./customer-identity";
import { reconcileServiceDuplicates } from "./wo-duplicates";

type SeedJob = {
  callId: string;
  contact: string | null;
  phone: string | null;
  received: string | null;
  customer: string | null;
  equipment: string | null;
  issue: string | null;
  type: string | null;
  phoneRes: boolean;
  status: string;
  tech: string | null;
  wo: string | null;
  scheduled: string | null;
  notes: string | null;
  done: boolean;
  kind: "service" | "tlc";
};

type SeedFile = {
  service: SeedJob[];
  tlc: SeedJob[];
  pms: {
    customer: string;
    received: string | null;
    equipment: string | null;
    style: string | null;
    projected: string | null;
    parts: string | null;
    status: string;
    tech: string | null;
    notes: string | null;
    done: boolean;
  }[];
  modules: {
    moduleId: string;
    platform: string | null;
    moduleType: string | null;
    status: string;
    wo: string | null;
    location: string | null;
    dateIn: string | null;
    dateReady: string | null;
    tech: string | null;
    notes: string | null;
  }[];
  deals: {
    customer: string;
    producer: string | null;
    accountType: string | null;
    dateOfDeal: string | null;
    equipment: string | null;
    amount: number | null;
    goodToOrder: boolean;
    ordered: boolean;
    eta: string | null;
    terms: string | null;
    invoice: string | null;
    completion: string | null;
    notes: string | null;
  }[];
  installs: {
    received: string | null;
    customer: string;
    equipment: string | null;
    equipStatus: string | null;
    installDate: string | null;
    tech: string | null;
    wo: string | null;
    reqsReady: string | null;
    notes: string | null;
    rep: string | null;
    payment: string | null;
    complete: boolean;
  }[];
};

const seed = seedJson as SeedFile;

type SeedAssetFile = {
  assets: {
    kind: "equip" | "dispenser" | "module";
    model: string;
    serial: string | null;
    qty: number;
    customerOwned: string | null;
    site: string;
    pallet: string | null;
    level: number | null;
    line: number | null;
    purpose: string | null;
    status: string;
  }[];
  recipes: {
    equipmentModel: string;
    coffee1: string;
    coffee2: string;
    coffee3: string;
    powder1: string;
    powder2: string;
    powder3: string;
    americano1: string;
    americano2: string;
    americano3: string;
    tea1?: string;
    tea2?: string;
    milk: string;
    notes: string;
  }[];
};

const assetSeed: SeedAssetFile = (() => {
  const raw = assetsJson as SeedAssetFile | { default: SeedAssetFile };
  if (raw && "assets" in raw && Array.isArray((raw as SeedAssetFile).assets)) {
    return raw as SeedAssetFile;
  }
  return (raw as { default: SeedAssetFile }).default;
})();

function cleanDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

async function insertMany(
  sql: Sql,
  table: string,
  cols: string[],
  rows: unknown[][],
) {
  const chunk = 25;
  const dateCols = new Set([
    "received",
    "scheduled",
    "projected",
    "date_in",
    "date_ready",
    "date_of_deal",
    "install_date",
    "sold_at",
  ]);
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const values: unknown[] = [];
    const placeholders = part.map((row, ri) => {
      const start = ri * cols.length;
      cols.forEach((col, ci) => {
        const raw = row[ci];
        values.push(dateCols.has(col) ? cleanDate(raw) : raw);
      });
      return `(${cols.map((_, ci) => `$${start + ci + 1}`).join(",")})`;
    });
    await sql.query(
      `insert into ${table} (${cols.join(",")}) values ${placeholders.join(",")}`,
      values,
    );
  }
}

const globalSeed = globalThis as typeof globalThis & { __deskSeedLive2__?: Promise<void> };

async function runPatch(name: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    console.error(`[katz-desk] ${name} failed`, err);
  }
}

/** Directory prune to the provided equipment list runs inside ensureSeeded (v3). */

export async function ensureSeeded(): Promise<void> {
  if (globalSeed.__deskSeedLive2__) return globalSeed.__deskSeedLive2__;
  globalSeed.__deskSeedLive2__ = (async () => {
    const sql = await getSql();
    const meta = await sql<{ v: string }>`select v from seed_meta where k = 'ops'`;
    if (meta[0]?.v !== "v2") {
    const already = await sql<{ id: number }>`select id from service_jobs limit 1`;
    if (already[0]) {
      await sql`insert into seed_meta (k, v) values ('ops', 'v2') on conflict (k) do update set v = 'v2'`;
    } else {

    await sql.query(
      `truncate table comments, activity, service_jobs, pm_jobs, modules, deals, installs restart identity cascade`,
    );

    const jobCols = [
      "kind",
      "call_id",
      "contact",
      "phone",
      "received",
      "customer",
      "equipment",
      "issue",
      "call_type",
      "phone_resolved",
      "status",
      "technician",
      "wo",
      "scheduled",
      "notes",
      "done",
    ];
    const jobRow = (j: SeedJob): unknown[] => [
      j.kind,
      j.callId,
      j.contact,
      j.phone,
      j.received,
      j.customer,
      j.equipment,
      j.issue,
      j.type,
      j.phoneRes,
      j.status,
      j.tech,
      j.wo,
      j.scheduled,
      j.notes,
      j.done,
    ];
    await insertMany(sql, "service_jobs", jobCols, [
      ...seed.service.map(jobRow),
      ...seed.tlc.map(jobRow),
    ]);

    await insertMany(
      sql,
      "pm_jobs",
      [
        "customer",
        "received",
        "equipment",
        "style",
        "projected",
        "parts_status",
        "status",
        "technician",
        "notes",
        "done",
      ],
      seed.pms.map((p) => [
        p.customer,
        p.received,
        p.equipment,
        p.style,
        p.projected,
        p.parts,
        p.status,
        p.tech,
        p.notes,
        p.done,
      ]),
    );

    await insertMany(
      sql,
      "modules",
      [
        "module_id",
        "platform",
        "module_type",
        "status",
        "wo",
        "location",
        "date_in",
        "date_ready",
        "technician",
        "notes",
      ],
      seed.modules.map((m) => [
        m.moduleId,
        m.platform,
        m.moduleType,
        m.status,
        m.wo,
        m.location,
        m.dateIn,
        m.dateReady,
        m.tech,
        m.notes,
      ]),
    );

    await insertMany(
      sql,
      "deals",
      [
        "customer",
        "producer",
        "account_type",
        "date_of_deal",
        "equipment",
        "amount",
        "good_to_order",
        "ordered",
        "eta",
        "terms",
        "invoice",
        "completion",
        "notes",
      ],
      seed.deals.map((d) => [
        d.customer,
        d.producer,
        d.accountType,
        d.dateOfDeal,
        d.equipment,
        d.amount,
        d.goodToOrder,
        d.ordered,
        d.eta,
        d.terms,
        d.invoice,
        d.completion === "✔" ? "complete" : d.completion === "X" ? "fell" : null,
        d.notes,
      ]),
    );

    await insertMany(
      sql,
      "installs",
      [
        "received",
        "customer",
        "equipment",
        "equip_status",
        "install_date",
        "technician",
        "wo",
        "reqs_ready",
        "notes",
        "account_rep",
        "payment_status",
        "complete",
      ],
      seed.installs.map((i) => [
        i.received,
        i.customer,
        i.equipment,
        i.equipStatus,
        i.installDate,
        i.tech,
        i.wo,
        i.reqsReady,
        i.notes,
        i.rep,
        i.payment,
        i.complete,
      ]),
    );

    await seedStarterComments(sql);
    await sql`insert into seed_meta (k, v) values ('ops', 'v2') on conflict (k) do update set v = 'v2'`;
    }
    }

    await runPatch("assets", () => seedAssets(sql));
    await runPatch("tea", () => patchRecipeTeaAndUrgency(sql));
    await runPatch("recipes", () => patchRecipeCustomers(sql));
    await runPatch("installs", () => patchInstallFields(sql));
    await runPatch("directory", () => patchDirectory(sql));
    await runPatch("notifications", () => patchNotifications(sql));
    await runPatch("handoff", () => patchHandoffOwners(sql));
    await runPatch("network", () => patchNetwork(sql));
    await runPatch("network-locations", () => patchNetworkLocations(sql));
    await runPatch("network-people", () => patchNetworkPeople(sql));
    await runPatch("customer-identity", () => patchCustomerIdentity(sql));
    await runPatch("wo-duplicates", () => patchWoDuplicates(sql));
    await runPatch("roster", () => patchRoster(sql));
    await runPatch("serial-notice", () => patchSerialNotice(sql));
    await runPatch("roles-reps-ak", () => patchRolesRepsAk(sql));
    await runPatch("rebuilds", () => patchRebuilds(sql));
    await runPatch("warehouse-bays-ap", () => patchWarehouseBays(sql));

    const n = await sql<{ n: number }>`select count(*)::int as n from service_jobs`;
    const c = await sql<{ n: number }>`select count(*)::int as n from directory_customers where archived = false`;
    console.info("[katz-desk] ready", n[0]?.n ?? 0, "jobs", c[0]?.n ?? 0, "customers");
  })().catch((err) => {
    console.error("[katz-desk] seed failed", err);
    globalSeed.__deskSeedLive2__ = undefined;
    throw err;
  });
  return globalSeed.__deskSeedLive2__;
}

async function seedAssets(sql: Sql) {
  const meta = await sql<{ v: string }>`select v from seed_meta where k = 'assets'`;
  if (meta[0]?.v === "v1") return;
  if (!assetSeed?.assets?.length) {
    throw new Error(`asset seed missing (${assetSeed?.assets?.length ?? "no array"})`);
  }
  await sql.query(`truncate table assets, recipes restart identity cascade`);
  console.info("[katz-desk] seeding assets", assetSeed.assets.length, "recipes", assetSeed.recipes.length);
  await insertMany(
    sql,
    "assets",
    [
      "kind",
      "model",
      "serial",
      "qty",
      "customer_owned",
      "site",
      "pallet",
      "level",
      "line_no",
      "purpose",
      "status",
    ],
    assetSeed.assets.map((a) => [
      a.kind,
      a.model,
      a.serial,
      a.qty,
      a.customerOwned,
      a.site,
      a.pallet,
      a.level,
      a.line,
      a.purpose,
      a.status,
    ]),
  );
  await insertMany(
    sql,
    "recipes",
    [
      "equipment_model",
      "coffee_1",
      "coffee_2",
      "coffee_3",
      "powder_1",
      "powder_2",
      "powder_3",
      "americano_1",
      "americano_2",
      "americano_3",
      "tea_1",
      "tea_2",
      "milk",
      "notes",
    ],
    assetSeed.recipes.map((r) => [
      r.equipmentModel,
      r.coffee1 || null,
      r.coffee2 || null,
      r.coffee3 || null,
      r.powder1 || null,
      r.powder2 || null,
      r.powder3 || null,
      r.americano1 || null,
      r.americano2 || null,
      r.americano3 || null,
      r.tea1 || null,
      r.tea2 || null,
      r.milk || null,
      r.notes || null,
    ]),
  );
  await sql`insert into seed_meta (k, v) values ('assets', 'v1') on conflict (k) do update set v = 'v1'`;
}

async function patchRecipeTeaAndUrgency(sql: Sql) {
  await sql.query("alter table recipes add column if not exists tea_1 text");
  await sql.query("alter table recipes add column if not exists tea_2 text");
  await sql.query(
    "alter table service_jobs add column if not exists urgency text not null default 'Normal'",
  );
  await sql.query("alter table service_jobs add column if not exists work_done text");
  await sql.query("alter table service_jobs add column if not exists completed_at date");
  await sql.query("alter table service_jobs add column if not exists duplicate_of int");
  await sql.query("alter table pm_jobs add column if not exists wo text");
  await sql.query("alter table pm_jobs add column if not exists work_done text");
  await sql.query("alter table pm_jobs add column if not exists completed_at date");
  await sql.query("alter table installs add column if not exists work_done text");
  await sql.query("alter table installs add column if not exists completed_at date");
  const meta = await sql<{ v: string }>`select v from seed_meta where k = 'tea_urgency'`;
  if (meta[0]?.v === "v1") return;
  await sql`
    update recipes
    set
      tea_1 = coalesce(nullif(tea_1, ''), coffee_1),
      tea_2 = coalesce(nullif(tea_2, ''), coffee_2),
      coffee_1 = null,
      coffee_2 = null,
      coffee_3 = null
    where equipment_model in ('Bunn ITCB', 'Bunn TB3')
      and coalesce(tea_1, '') = ''`;
  await sql`
    update service_jobs
    set urgency = 'High'
    where kind = 'service'
      and done = false
      and status not in ('Completed', 'Cancelled', 'Phone Resolved')
      and received is not null
      and received <= (current_date - 2)
      and urgency = 'Normal'`;
  await sql`insert into seed_meta (k, v) values ('tea_urgency', 'v1') on conflict (k) do update set v = 'v1'`;
}

async function patchRecipeCustomers(sql: Sql) {
  try {
    await sql.query("alter table recipes drop constraint if exists recipes_equipment_model_key");
  } catch {
    /* already gone */
  }
  try {
    await sql.query("drop index if exists recipes_equipment_model_key");
  } catch {
    /* constraint-backed index */
  }
  await sql.query("alter table recipes add column if not exists customer text");
  await sql.query("alter table recipes add column if not exists install_id int");
  await sql.query("alter table recipes add column if not exists copied_from int");
  await sql.query(
    "alter table recipes add column if not exists is_template boolean not null default false",
  );
  await sql.query(
    "create index if not exists recipes_customer_idx on recipes (lower(customer))",
  );
  await sql.query("create index if not exists recipes_install_idx on recipes (install_id)");
  await sql.query(
    "create index if not exists recipes_model_idx on recipes (lower(equipment_model))",
  );
  await sql.query(`
    create unique index if not exists recipes_house_model_uidx
      on recipes (lower(equipment_model))
      where customer is null`);
  await sql.query(`
    create unique index if not exists recipes_customer_model_uidx
      on recipes (lower(customer), lower(equipment_model))
      where customer is not null`);
  await sql`update recipes set is_template = true where customer is null`;

  const meta = await sql<{ v: string }>`select v from seed_meta where k = 'recipes_customers'`;
  if (meta[0]?.v === "v1") return;

  const copies: { customer: string; model: string }[] = [
    { customer: "Gennaro's - Wimberly", model: "Bunn ITCB" },
    { customer: "La Michoacana #52 - Dallas", model: "Bunn ITCB" },
    { customer: "Hunter Road Country Club", model: "Bunn ITCB" },
    { customer: "Cheeks Coffee", model: "Bunn ITCB" },
    { customer: "Southerleigh SA Airport", model: "Bunn ITCB" },
    { customer: "Cowgirl Coffee", model: "Bunn Axiom-APS" },
    { customer: "Shirley's Donut", model: "Bunn Axiom-APS" },
    { customer: "CoPlay Cove", model: "Eversys e'4s" },
    { customer: "CoPlay Cove", model: "Bunn Axiom-APS" },
    { customer: "Clover", model: "Eversys e'4s" },
    { customer: "Brew & Books", model: "Eversys Cameo c'2s" },
    { customer: "The Audrey Restaurant & Bar Post Oak", model: "Eversys Cameo c'2s" },
    { customer: "kol fac 118", model: "Eversys Cameo c'2s" },
    { customer: "kol fac 118", model: "Bunn ITCB" },
    { customer: "Ninfa's - Navigation", model: "Bunn TB3" },
    { customer: "Coco Shrimp - Dallas", model: "Bunn TB3" },
  ];

  for (const c of copies) {
    const house = await sql<Record<string, unknown>>`
      select * from recipes
      where customer is null and lower(equipment_model) = ${c.model.toLowerCase()}
      limit 1`;
    const src = house[0];
    if (!src) continue;
    const exists = await sql<{ id: number }>`
      select id from recipes
      where lower(equipment_model) = ${c.model.toLowerCase()}
        and lower(customer) = ${c.customer.toLowerCase()}`;
    if (exists[0]) continue;
    const ins = await sql<{ id: number }>`
      select id from installs where lower(customer) = ${c.customer.toLowerCase()} limit 1`;
    try {
      await sql.query(
        `insert into recipes (
          equipment_model, customer, install_id, copied_from, is_template,
          coffee_1, coffee_2, coffee_3,
          powder_1, powder_2, powder_3, americano_1, americano_2, americano_3,
          tea_1, tea_2, milk, notes
        ) values ($1,$2,$3,$4,false,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          src.equipment_model,
          c.customer,
          ins[0]?.id ?? null,
          src.id,
          src.coffee_1 ?? null,
          src.coffee_2 ?? null,
          src.coffee_3 ?? null,
          src.powder_1 ?? null,
          src.powder_2 ?? null,
          src.powder_3 ?? null,
          src.americano_1 ?? null,
          src.americano_2 ?? null,
          src.americano_3 ?? null,
          src.tea_1 ?? null,
          src.tea_2 ?? null,
          src.milk ?? null,
          src.notes ?? null,
        ],
      );
    } catch (err) {
      console.warn("[katz-desk] recipe copy skipped", c.customer, c.model, err);
    }
  }

  await sql`insert into seed_meta (k, v) values ('recipes_customers', 'v1') on conflict (k) do update set v = 'v1'`;
}

async function patchInstallFields(sql: Sql) {
  await sql.query("alter table installs add column if not exists serial text");
  await sql.query("alter table installs add column if not exists power_voltage text");
  await sql.query("alter table installs add column if not exists machines text");
  await sql.query("alter table assets add column if not exists origin_site text");
  await sql.query("alter table assets add column if not exists origin_pallet text");
  await sql.query("alter table assets add column if not exists origin_level int");
  await sql.query("alter table assets add column if not exists review_status text");
  await sql.query("alter table assets add column if not exists review_note text");
  await sql.query("alter table assets add column if not exists review_actor text");
  await sql.query("alter table assets add column if not exists review_origin text");
  await sql.query("alter table assets add column if not exists review_from_site text");
  await sql.query("alter table assets add column if not exists review_from_pallet text");
  await sql.query("alter table assets add column if not exists review_from_level int");
  await sql.query("alter table assets add column if not exists review_from_line int");
  await sql.query("alter table assets add column if not exists review_from_status text");
  await sql.query("alter table assets add column if not exists shop_test text");
  await sql.query("alter table assets add column if not exists shop_test_note text");
  await sql.query("alter table assets add column if not exists shop_test_by text");
  await sql.query("alter table assets add column if not exists shop_test_at timestamptz");
}

async function insertNames(sql: Sql, table: string, names: string[]) {
  const chunk = 40;
  for (let i = 0; i < names.length; i += chunk) {
    const part = names
      .slice(i, i + chunk)
      .map((n) => String(n).trim())
      .filter(Boolean);
    if (!part.length) continue;
    const values: unknown[] = [];
    const placeholders = part.map((n, ri) => {
      values.push(n);
      return `($${ri + 1})`;
    });
    await sql.query(
      `insert into ${table} (name) values ${placeholders.join(",")} on conflict do nothing`,
      values,
    );
  }
}

function asStringList(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { default?: unknown }).default)
      ? (raw as { default: unknown[] }).default
      : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    if (typeof item !== "string") continue;
    const name = item.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    if (/^[0-9a-f]{32}$/i.test(name) || /^[0-9a-f-]{36}$/i.test(name)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

async function patchDirectory(sql: Sql) {
  await sql.query(`
    create table if not exists directory_customers (
      id         serial primary key,
      name       text not null,
      archived   boolean not null default false,
      updated_at timestamptz not null default now()
    )`);
  await sql.query(`
    create table if not exists directory_equipment (
      id         serial primary key,
      name       text not null,
      archived   boolean not null default false,
      updated_at timestamptz not null default now()
    )`);
  await sql.query(
    "create unique index if not exists directory_customers_name_uidx on directory_customers (name)",
  );
  await sql.query(
    "create unique index if not exists directory_equipment_name_uidx on directory_equipment (name)",
  );

  const meta = await sql<{ v: string }>`select v from seed_meta where k = 'directory'`;
  if (meta[0]?.v === "v3") return;
  const customers = asStringList(directoryCustomersJson);
  const equipment = asStringList(directoryEquipmentJson);

  console.info("[katz-desk] seeding directory", customers.length, "customers", equipment.length, "equipment");
  if (customers.length) await insertNames(sql, "directory_customers", customers);
  if (equipment.length) await insertNames(sql, "directory_equipment", equipment);
  await sql.query(`
    insert into directory_customers (name)
    select distinct trim(customer) from (
      select customer from installs
      union select customer from deals
      union select customer from service_jobs
      union select customer from pm_jobs
      union select customer from recipes
    ) t
    where coalesce(trim(customer), '') <> ''
      and not exists (
        select 1 from directory_customers d where lower(d.name) = lower(trim(t.customer))
      )`);

  if (equipment.length) {
    const keep = new Set(equipment.map((n) => n.toLowerCase()));
    const extras = await sql.query<{ id: number; name: string }>(
      "select id, name from directory_equipment where archived = false",
    );
    for (const row of extras) {
      if (!keep.has(row.name.toLowerCase())) {
        await sql.query("update directory_equipment set archived = true, updated_at = now() where id = $1", [
          row.id,
        ]);
      }
    }
    const placeholders = equipment.map((_, i) => `$${i + 1}`).join(",");
    await sql.query(
      `update directory_equipment set archived = false, updated_at = now()
       where lower(name) in (${placeholders})`,
      equipment.map((n) => n.toLowerCase()),
    );
  }

  await sql`insert into seed_meta (k, v) values ('directory', 'v3') on conflict (k) do update set v = 'v3'`;
}

async function patchNotifications(sql: Sql) {
  await sql.query(`
    create table if not exists desk_notifications (
      id            serial primary key,
      user_id       text not null,
      from_user_id  text,
      from_name     text,
      body          text not null,
      entity_type   text,
      entity_id     int,
      read          boolean not null default false,
      created_at    timestamptz not null default now()
    )`);
  await sql.query(
    "create index if not exists desk_notifications_inbox_idx on desk_notifications (user_id, read, created_at desc)",
  );
}

async function patchHandoffOwners(sql: Sql) {
  await sql.query(`
    alter table deals add column if not exists handed_off boolean not null default false
  `);
  await sql.query(`
    update deals d
    set handed_off = true
    where d.handed_off = false
      and (
        exists (select 1 from installs i where i.deal_id = d.id)
        or (
          d.completion = 'complete'
          and exists (
            select 1 from installs i
            where i.archived = false
              and lower(i.customer) = lower(d.customer)
          )
        )
      )
  `);
  await sql.query(`
    update comments
    set author_name = null
    where author_id is null
      and author_name is not null
  `);
}

async function patchNetwork(sql: Sql) {
  const meta = await sql<{ v: string }>`select v from seed_meta where k = 'network'`;
  if (meta[0]?.v === "v1") return;

  await sql.query(`
    create table if not exists network_providers (
      id                 serial primary key,
      name               text not null,
      status             text,
      dispatch_phone     text,
      dispatch_email     text,
      secondary_phone    text,
      secondary_email    text,
      response_time      text,
      standard_rate      text,
      after_hours_rate   text,
      travel_policy      text,
      equipment_serviced text,
      coverage           text,
      contacts           text,
      pm_pricing         text,
      parts_stocking     text,
      notes              text,
      last_updated       date,
      archived           boolean not null default false,
      updated_at         timestamptz not null default now()
    )`);
  await sql.query(
    "create unique index if not exists network_providers_name_uidx on network_providers (lower(name))",
  );
  await sql.query(`
    create table if not exists network_accounts (
      id          serial primary key,
      customer    text not null,
      email       text,
      contact     text,
      phone       text,
      address     text,
      city        text,
      state       text,
      zip         text,
      equipment   text,
      ownership   text,
      region      text,
      updated_at  timestamptz not null default now()
    )`);
  await sql.query(
    "create unique index if not exists network_accounts_customer_uidx on network_accounts (lower(customer))",
  );
  await sql.query(`
    create table if not exists customer_providers (
      id          serial primary key,
      customer    text not null,
      provider_id int not null references network_providers(id),
      role        text not null default 'additional',
      updated_at  timestamptz not null default now()
    )`);
  await sql.query(
    "create unique index if not exists customer_providers_pair_uidx on customer_providers (provider_id, lower(customer))",
  );

  type SeedProvider = {
    name: string;
    status: string | null;
    dispatchPhone: string | null;
    dispatchEmail: string | null;
    secondaryPhone: string | null;
    secondaryEmail: string | null;
    responseTime: string | null;
    standardRate: string | null;
    afterHoursRate: string | null;
    travelPolicy: string | null;
    equipmentServiced: string | null;
    coverage: string | null;
    contacts: string | null;
    pmPricing: string | null;
    partsStocking: string | null;
    notes: string | null;
    lastUpdated: string | null;
  };
  type SeedAccount = {
    name: string;
    email: string | null;
    contact: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    equipment: string | null;
    ownership: string | null;
    primary: string | null;
    secondary: string | null;
    region: string | null;
  };

  const providers = networkProvidersJson as SeedProvider[];
  const accounts = networkAccountsJson as SeedAccount[];

  for (const p of providers) {
    await sql.query(
      `insert into network_providers (
         name, status, dispatch_phone, dispatch_email, secondary_phone, secondary_email,
         response_time, standard_rate, after_hours_rate, travel_policy, equipment_serviced,
         coverage, contacts, pm_pricing, parts_stocking, notes, last_updated
       )
       select $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
       where not exists (select 1 from network_providers where lower(name) = lower($1))`,
      [
        p.name,
        p.status,
        p.dispatchPhone,
        p.dispatchEmail,
        p.secondaryPhone,
        p.secondaryEmail,
        p.responseTime,
        p.standardRate,
        p.afterHoursRate,
        p.travelPolicy,
        p.equipmentServiced,
        p.coverage,
        p.contacts,
        p.pmPricing,
        p.partsStocking,
        p.notes,
        p.lastUpdated,
      ],
    );
  }

  const ids = await sql.query<{ id: number; name: string }>(`select id, name from network_providers`);
  const byName = new Map(ids.map((r) => [r.name.trim().toLowerCase(), r.id]));

  for (const a of accounts) {
    await sql.query(
      `insert into directory_customers (name)
       select $1
       where not exists (select 1 from directory_customers where lower(name) = lower($1))`,
      [a.name],
    );
    await sql.query(
      `insert into network_accounts (customer, email, contact, phone, address, city, state, zip, equipment, ownership, region)
       select $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
       where not exists (select 1 from network_accounts where lower(customer) = lower($1))`,
      [
        a.name,
        a.email,
        a.contact,
        a.phone,
        a.address,
        a.city,
        a.state,
        a.zip,
        a.equipment,
        a.ownership,
        a.region,
      ],
    );
    const pairs: { name: string | null; role: string }[] = [
      { name: a.primary, role: "primary" },
      { name: a.secondary, role: "secondary" },
    ];
    for (const pair of pairs) {
      if (!pair.name) continue;
      const pid = byName.get(pair.name.trim().toLowerCase());
      if (!pid) continue;
      await sql.query(
        `insert into customer_providers (customer, provider_id, role)
         select $1, $2, $3
         where not exists (
           select 1 from customer_providers
           where provider_id = $2 and lower(customer) = lower($1)
         )`,
        [a.name, pid, pair.role],
      );
    }
  }

  await sql`insert into seed_meta (k, v) values ('network', 'v1') on conflict (k) do update set v = 'v1'`;
}

async function patchNetworkLocations(sql: Sql) {
  const meta = await sql<{ v: string }>`select v from seed_meta where k = 'network-locations'`;
  if (meta[0]?.v === "v3") return;

  await sql.query(`
    create table if not exists provider_locations (
      id          serial primary key,
      provider_id int not null references network_providers(id) on delete cascade,
      state       text not null,
      city        text,
      zip         text,
      created_at  timestamptz not null default now()
    )`);
  await sql.query(`
    create unique index if not exists provider_locations_uniq
    on provider_locations (provider_id, state, coalesce(lower(city), ''), coalesce(zip, ''))
  `);

  await sql.query(`truncate table provider_locations restart identity`);
  const providers = await sql.query<{ id: number; coverage: string | null }>(
    `select id, coverage from network_providers where archived = false`,
  );
  const existing = await sql.query<{
    provider_id: number;
    state: string;
    city: string | null;
    zip: string | null;
  }>(`select provider_id, state, city, zip from provider_locations`);
  const byProv = new Map<number, { state: string; city: string | null; zip: string | null }[]>();
  for (const e of existing) {
    const list = byProv.get(e.provider_id) ?? [];
    list.push(e);
    byProv.set(e.provider_id, list);
  }

  const insert = async (
    providerId: number,
    state: string,
    city: string | null,
    zip: string | null,
  ) => {
    const st = normalizeState(state);
    if (!st) return;
    const c = normalizeCity(city);
    const z = normalizeZip(zip);
    const list = byProv.get(providerId) ?? [];
    if (findDuplicateLocation(list, { state: st, city: c, zip: z })) return;
    await sql.query(
      `insert into provider_locations (provider_id, state, city, zip) values ($1,$2,$3,$4)`,
      [providerId, st, c, z],
    );
    list.push({ state: st, city: c, zip: z });
    byProv.set(providerId, list);
  };

  for (const p of providers) {
    for (const loc of parseCoverageLocations(p.coverage)) {
      await insert(p.id, loc.state, loc.city, loc.zip);
    }
  }

  const assigned = await sql.query<{
    provider_id: number;
    city: string | null;
    state: string | null;
    zip: string | null;
  }>(`
    select cp.provider_id, a.city, a.state, a.zip
    from customer_providers cp
    join network_accounts a on lower(a.customer) = lower(cp.customer)
    where a.state is not null
  `);
  for (const a of assigned) {
    await insert(a.provider_id, a.state ?? "", a.city, a.zip);
  }

  await sql`insert into seed_meta (k, v) values ('network-locations', 'v3') on conflict (k) do update set v = 'v3'`;
}

async function patchNetworkPeople(sql: Sql) {
  const meta = await sql<{ v: string }>`select v from seed_meta where k = 'network-people'`;
  if (meta[0]?.v === "v1") return;

  await sql.query(`
    create table if not exists provider_contacts (
      id          serial primary key,
      provider_id int not null references network_providers(id) on delete cascade,
      name        text,
      role        text,
      phone       text,
      email       text,
      created_at  timestamptz not null default now()
    )`);
  await sql.query(`
    create table if not exists provider_addresses (
      id          serial primary key,
      provider_id int not null references network_providers(id) on delete cascade,
      label       text,
      line1       text,
      line2       text,
      city        text,
      state       text,
      zip         text,
      created_at  timestamptz not null default now()
    )`);

  const rows = await sql.query<{ id: number; name: string; contacts: string | null }>(
    `select id, name, contacts from network_providers where archived = false`,
  );
  for (const p of rows) {
    const parsed = parseContactBlob(p.contacts, p.name);
    for (const c of parsed.people) {
      await sql.query(
        `insert into provider_contacts (provider_id, name, role, phone, email) values ($1,$2,$3,$4,$5)`,
        [p.id, c.name, c.role, c.phone, c.email],
      );
    }
    for (const a of parsed.addresses) {
      await sql.query(
        `insert into provider_addresses (provider_id, label, line1, line2, city, state, zip) values ($1,$2,$3,$4,$5,$6,$7)`,
        [p.id, a.label, a.line1, a.line2, a.city, a.state, a.zip],
      );
    }
  }

  await sql`insert into seed_meta (k, v) values ('network-people', 'v1') on conflict (k) do update set v = 'v1'`;
}

async function patchCustomerIdentity(sql: Sql) {
  const meta = await sql<{ v: string }>`select v from seed_meta where k = 'customer-identity'`;
  if (meta[0]?.v === "v1") return;

  const dups = await sql.query<{ k: string; ids: number[] }>(
    `select lower(name) as k, array_agg(id order by id) as ids
     from directory_customers
     group by lower(name)
     having count(*) > 1`,
  ).catch(() => [] as { k: string; ids: number[] }[]);
  for (const d of dups) {
    const raw = d.ids as unknown;
    const ids = Array.isArray(raw)
      ? raw.map(Number)
      : String(raw ?? "")
          .replace(/[{}]/g, "")
          .split(",")
          .map((n) => Number(n.trim()))
          .filter((n) => Number.isFinite(n));
    if (ids.length < 2) continue;
    const keep = await sql.query<{ id: number; name: string }>(
      `select id, name from directory_customers where id = $1`,
      [ids[0]],
    );
    const keepName = keep[0]?.name;
    if (!keepName) continue;
    for (const extraId of ids.slice(1)) {
      const extra = await sql.query<{ name: string }>(`select name from directory_customers where id = $1`, [extraId]);
      try {
        if (extra[0] && extra[0].name !== keepName) {
          await retargetCustomer(sql, extra[0].name, keepName);
        }
      } catch (err) {
        console.error("[katz-desk] customer merge skipped", extraId, err);
      }
      // A case-only twin cannot keep its name: lower(name) would still collide
      // after archive. Park it under a unique archived label.
      const parked = `${(extra[0]?.name || "customer").slice(0, 140)} · merged ${extraId}`;
      await sql.query(
        `update directory_customers set name = $2, archived = true, updated_at = now() where id = $1`,
        [extraId, parked],
      );
    }
  }

  await sql.query(`drop index if exists directory_customers_name_uidx`);
  try {
    await sql.query(
      `create unique index if not exists directory_customers_name_lower_uidx on directory_customers (lower(name))`,
    );
  } catch (err) {
    console.error("[katz-desk] customer unique index skipped", err);
  }

  await sql`insert into seed_meta (k, v) values ('customer-identity', 'v1') on conflict (k) do update set v = 'v1'`;
}

async function patchWoDuplicates(sql: Sql) {
  await sql.query("alter table service_jobs add column if not exists duplicate_of int");
  await sql.query(
    "create index if not exists service_jobs_duplicate_of_idx on service_jobs (duplicate_of)",
  );
  const meta = await sql<{ v: string }>`select v from seed_meta where k = 'wo_duplicates'`;
  if (meta[0]?.v === "v1") return;
  const result = await reconcileServiceDuplicates(sql, "KatzDesk");
  console.info("[katz-desk] wo duplicates", result.merged, "merged", result.flagged, "flagged");
  await sql`insert into seed_meta (k, v) values ('wo_duplicates', 'v1') on conflict (k) do update set v = 'v1'`;
}

async function patchRoster(sql: Sql) {
  const { ensureRoster } = await import("./roster");
  await ensureRoster(sql);
}

async function patchSerialNotice(sql: Sql) {
  const { ensureSerialNotice } = await import("./serial-pull");
  await ensureSerialNotice(sql);
}

async function patchRolesRepsAk(sql: Sql) {
  await sql.query("alter table desk_accounts add column if not exists desk_role text");
  await sql.query("alter table desk_notifications add column if not exists customer text");
  const { ensureReps, remapStoredReps, ensureAccountMarks } = await import("./reps");
  await ensureReps(sql);
  await ensureAccountMarks(sql);
  const mapped = await remapStoredReps(sql);
  console.info("[katz-desk] remapped reps", mapped.deals, "deals", mapped.installs, "installs", mapped.customers, "customers");
}

async function patchRebuilds(sql: Sql) {
  const { seedRebuilds } = await import("./rebuilds");
  await seedRebuilds(sql);
}

async function patchWarehouseBays(sql: Sql) {
  const meta = await sql.query<{ v: string }>("select v from seed_meta where k = 'warehouse-bays-ap'");
  if (meta[0]?.v === "v1") return;
  const leftover = await sql.query<{ n: number }>(`
    select count(*)::int as n from assets
    where (pallet is not null and length(btrim(pallet)) = 1 and upper(btrim(pallet)) = 'Q')
       or (origin_pallet is not null and length(btrim(origin_pallet)) = 1 and upper(btrim(origin_pallet)) = 'Q')
  `);
  const migrated = await sql.query<{ name: string }>(
    "select name from _migrations where name = '0026_warehouse_bays_ap.sql'",
  );
  // Shift when Q still exists (fresh seed from old labels) or 0026 has not run yet.
  // Skip when 0026 already shifted live B–Q and no Q remains — running again would
  // walk D–P down another letter.
  if ((leftover[0]?.n ?? 0) > 0 || !migrated[0]) {
    await sql.query(`
      update assets
        set pallet = chr(ascii(upper(btrim(pallet))) - 1)
        where pallet is not null
          and length(btrim(pallet)) = 1
          and upper(btrim(pallet)) ~ '^[B-Q]$'
    `);
    await sql.query(`
      update assets
        set origin_pallet = chr(ascii(upper(btrim(origin_pallet))) - 1)
        where origin_pallet is not null
          and length(btrim(origin_pallet)) = 1
          and upper(btrim(origin_pallet)) ~ '^[B-Q]$'
    `);
  }
  await sql.query(
    `insert into seed_meta (k, v) values ('warehouse-bays-ap', 'v1') on conflict (k) do update set v = 'v1'`,
  );
}


async function seedStarterComments(sql: Sql) {
  const findJob = async (kind: string, customer: string) => {
    const rows = await sql<{ id: number }>`
      select id from service_jobs
      where kind = ${kind} and lower(customer) = ${customer.toLowerCase()}
      order by id limit 1`;
    return rows[0]?.id;
  };
  const findPm = async (customer: string) => {
    const rows = await sql<{ id: number }>`
      select id from pm_jobs where lower(customer) = ${customer.toLowerCase()} limit 1`;
    return rows[0]?.id;
  };
  const findInstall = async (customer: string) => {
    const rows = await sql<{ id: number }>`
      select id from installs where lower(customer) = ${customer.toLowerCase()} limit 1`;
    return rows[0]?.id;
  };
  const findDeal = async (customer: string) => {
    const rows = await sql<{ id: number }>`
      select id from deals where lower(customer) = ${customer.toLowerCase()} limit 1`;
    return rows[0]?.id;
  };

  const notes: {
    type: string;
    customer: string;
    author: string;
    body: string;
    ask: string | null;
  }[] = [
    {
      type: "service",
      customer: "Milton's",
      author: "Charles",
      body: "On site 8/18 — waiting on a replacement brew group. Can sales confirm if a loaner Cameo is still available for them this week?",
      ask: "sales",
    },
    {
      type: "service",
      customer: "The Gathery",
      author: "Oliver",
      body: "Dispatched 8/4, never got a window. Need someone to call the account and lock a morning this week.",
      ask: "sales",
    },
    {
      type: "tlc",
      customer: "Tejas Choco & BBQ - Spring",
      author: "Amanda",
      body: "This TLC has been open since June. Customer said they were remodeling — I pinged them yesterday, still no install window. Service: leave it parked or close it out?",
      ask: "service",
    },
    {
      type: "tlc",
      customer: "Hyde Park",
      author: "Lizbeth",
      body: "Scheduled date of 7/16 slipped. Account wants a September visit. Updating notes — please don’t dispatch until I confirm.",
      ask: "service",
    },
    {
      type: "pm",
      customer: "Eurest USA",
      author: "Josh",
      body: "12-month PM is on the 28th. Parts are here. Need a tech assigned so we don’t miss the window.",
      ask: "service",
    },
    {
      type: "install",
      customer: "kol fac 118",
      author: "Amanda",
      body: "Cameo + ITCB deal is complete and invoiced. Site plumbing is not ready. Holding until the GC gives us a date.",
      ask: "service",
    },
    {
      type: "install",
      customer: "Southern Ice CO",
      author: "Oliver",
      body: "Bench is done, WO-0406 is open. Waiting on paperwork before we roll. Loaner ITCB is boxed if they need it today.",
      ask: "sales",
    },
    {
      type: "deal",
      customer: "Coco Crepe Elyson Town Center",
      author: "Lizbeth",
      body: "Still under remodel — do not order a bench slot. I’ll mark good-to-install once they give us keys.",
      ask: "service",
    },
    {
      type: "deal",
      customer: "Parkwood American Grille",
      author: "Amanda",
      body: "Legacy is mid-August. They’re running the Cameo loaner until it lands. Service already installed the loaner — this is just the swap.",
      ask: null,
    },
    {
      type: "install",
      customer: "Ninfa's - Navigation",
      author: "Jesus",
      body: "Additional TB3 — equipment is ready, original date was 8/13. Need a new morning this week or next.",
      ask: "service",
    },
  ];

  for (const n of notes) {
    let id: number | undefined;
    if (n.type === "service" || n.type === "tlc") id = await findJob(n.type, n.customer);
    else if (n.type === "pm") id = await findPm(n.customer);
    else if (n.type === "install") id = await findInstall(n.customer);
    else if (n.type === "deal") id = await findDeal(n.customer);
    if (!id) continue;
    await sql`
      insert into comments (entity_type, entity_id, author_name, body, ask_team)
      values (${n.type}, ${id}, ${null}, ${n.body}, ${n.ask})`;
  }
}
