import { getSql } from "@/lib/db";
import type { Sql } from "@/lib/db";
import seedJson from "./seed-data.json";
import assetsJson from "./seed-assets.json";
import directoryCustomersJson from "./directory-customers.json";
import directoryEquipmentJson from "./directory-equipment.json";

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

let seeding: Promise<void> | null = null;

/** Directory prune to the provided equipment list runs inside ensureSeeded (v3). */

export async function ensureSeeded(): Promise<void> {
  if (seeding) return seeding;
  seeding = (async () => {
    const sql = await getSql();
    const meta = await sql<{ v: string }>`select v from seed_meta where k = 'ops'`;
    if (meta[0]?.v !== "v2") {

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

    await seedAssets(sql);
    await patchRecipeTeaAndUrgency(sql);
    await patchRecipeCustomers(sql);
    await patchInstallFields(sql);
    await patchDirectory(sql);
    await patchNotifications(sql);
  })().catch((err) => {
    console.error("[katz-desk] seed failed", err);
    seeding = null;
    throw err;
  });
  return seeding;
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
      values (${n.type}, ${id}, ${n.author}, ${n.body}, ${n.ask})`;
  }
}
