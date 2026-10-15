import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as XLSX from "xlsx";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import { todayChicago } from "@/lib/ops/clock";
import type { PinQuality } from "@/lib/ops/geo";
import type { ProviderRole } from "@/lib/ops/network";
import {
  countProviderPlan,
  MAX_PROVIDER_ROWS,
  MERGE_FILL_FIELDS,
  planProviderImport,
  providerRowsFromMatrix,
  providerWrites,
  type AddressWrite,
  type ImportContact,
  type ImportProvider,
  type MergeFillColumn,
  type ProviderCreateWrite,
  type ProviderImportRow,
  type ProviderMergeWrite,
  type ProviderPlanCounts,
  type ProviderPlanLine,
  type ProviderUpdateWrite,
} from "@/lib/ops/provider-import";

async function ready() {
  const { ensureSeeded } = await import("./seed.server");
  await ensureSeeded();
  return getSql();
}

/** Providers are imported by an Admin (the Admin role or a desk admin), same as the other imports. */
async function requireEditor(sql: Sql, userId: string) {
  if (!(await canReviewNames(sql, userId))) throw new Error("Only an Admin can import providers.");
}

/** The name on activity rows, resolved the same way as everywhere else on the desk (username, else "Teammate"). */
async function actorName(sql: Sql, userId: string): Promise<string> {
  return (await sql.query<{ username: string | null }>("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "Teammate";
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const quality = (v: string | null): PinQuality | null => (v === "exact" || v === "close" || v === "approx" ? v : null);
const role = (v: string): ProviderRole => (v === "primary" || v === "secondary" ? v : "additional");

/** Every provider (archived ones too, so a merge already done is recognised), with addresses and counts. Bounded. */
async function loadProviders(sql: Sql): Promise<ImportProvider[]> {
  const rows = await sql.query<{
    id: number;
    name: string;
    archived: unknown;
    merged_into: number | null;
    status: string | null;
    dispatch_phone: string | null;
    dispatch_email: string | null;
    website: string | null;
    coverage: string | null;
    contacts: number;
    coverage_rows: number;
  } & Partial<Record<`t_${MergeFillColumn}`, string | null>>>(
    `select p.id, p.name, p.archived, p.merged_into, p.status, p.dispatch_phone, p.dispatch_email, p.website, p.coverage,
            ${MERGE_FILL_FIELDS.map(([col]) => `p.${col} as t_${col}`).join(", ")},
            (select count(*)::int from provider_contacts c where c.provider_id = p.id) as contacts,
            (select count(*)::int from provider_locations l where l.provider_id = p.id) as coverage_rows
       from network_providers p
      order by p.id
      limit 5000`,
  );
  const addresses = await sql.query<{
    id: number;
    provider_id: number;
    label: string | null;
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    latitude: unknown;
    longitude: unknown;
    geocode_match: string | null;
    geocode_address: string | null;
  }>(
    `select id, provider_id, label, line1, line2, city, state, zip, latitude, longitude, geocode_match, geocode_address
       from provider_addresses order by id limit 20000`,
  );
  const links = await sql.query<{ provider_id: number; customer: string; role: string }>(
    `select provider_id, lower(customer) as customer, role from customer_providers order by id limit 50000`,
  );
  const people = await sql.query<{ id: number; provider_id: number; name: string | null; role: string | null; phone: string | null; email: string | null }>(
    `select id, provider_id, name, role, phone, email from provider_contacts order by id limit 50000`,
  );
  const peopleBy = new Map<number, ImportContact[]>();
  for (const c of people) {
    const pid = Number(c.provider_id);
    peopleBy.set(pid, [...(peopleBy.get(pid) ?? []), { id: Number(c.id), name: c.name, role: c.role, phone: c.phone, email: c.email }]);
  }
  const addrBy = new Map<number, ImportProvider["addresses"]>();
  for (const a of addresses) {
    const list = addrBy.get(a.provider_id) ?? [];
    const lat = num(a.latitude);
    const lng = num(a.longitude);
    list.push({
      id: a.id,
      label: a.label,
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      state: a.state,
      zip: a.zip,
      latitude: lat,
      longitude: lng,
      quality: lat != null && lng != null ? quality(a.geocode_match) : null,
      geocodeAddress: a.geocode_address,
    });
    addrBy.set(a.provider_id, list);
  }
  const linkBy = new Map<number, ImportProvider["assignments"]>();
  for (const l of links) linkBy.set(l.provider_id, [...(linkBy.get(l.provider_id) ?? []), { customer: l.customer, role: role(l.role) }]);
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    archived: r.archived === true || r.archived === "t" || r.archived === "true",
    mergedInto: r.merged_into == null ? null : Number(r.merged_into),
    status: r.status,
    dispatchPhone: r.dispatch_phone,
    dispatchEmail: r.dispatch_email,
    website: r.website,
    coverage: r.coverage,
    addresses: addrBy.get(Number(r.id)) ?? [],
    assignments: linkBy.get(Number(r.id)) ?? [],
    contacts: Number(r.contacts ?? 0),
    coverageRows: Number(r.coverage_rows ?? 0),
    people: peopleBy.get(Number(r.id)) ?? [],
    texts: Object.fromEntries(MERGE_FILL_FIELDS.map(([col]) => [col, r[`t_${col}`] ?? null])),
  }));
}

const rowSchema = z.object({
  line: z.number().int().min(1).max(1_000_000),
  providerId: z.number().int().positive().max(2_147_483_647).nullable(),
  currentName: z.string().max(300),
  name: z.string().max(300),
  mergeInto: z.string().max(300),
  status: z.string().max(60),
  address: z.string().max(300),
  city: z.string().max(120),
  state: z.string().max(60),
  zip: z.string().max(20),
  dispatchPhone: z.string().max(300),
  dispatchEmail: z.string().max(300),
  website: z.string().max(500),
  coverage: z.string().max(4000),
  latitude: z.number().finite().nullable(),
  longitude: z.number().finite().nullable(),
  matchType: z.string().max(60),
  matchedAddress: z.string().max(300),
  verified: z.string().max(60),
  notes: z.string().max(4000),
});

/** About 9 MB of file (base64 is 4/3 of the bytes). */
const MAX_BASE64 = 12_000_000;

const previewInput = z
  .object({
    filename: z.string().max(300).optional(),
    base64: z.string().min(4).max(MAX_BASE64).optional(),
    rows: z.array(rowSchema).min(1).max(MAX_PROVIDER_ROWS).optional(),
    addNew: z.boolean().default(false),
  })
  .refine((d) => !!d.base64 !== !!d.rows, { message: "Send the file or the rows read from it." });

export type ProviderImportPreview = { rows: ProviderImportRow[]; lines: ProviderPlanLine[]; counts: ProviderPlanCounts };

/**
 * The file as a workbook. A CSV (anything that is not an Excel zip or an old .xls) is read as UTF-8 text first: the
 * spreadsheet reader only spots UTF-8 when the file starts with a byte-order mark, and reads the rest as Latin-1
 * ("•" would become "â¢"). A file that is not valid UTF-8 (an old Windows CSV) is read as before.
 */
function readWorkbook(base64: string): XLSX.WorkBook {
  const bytes = Buffer.from(base64, "base64");
  const excel = (bytes[0] === 0x50 && bytes[1] === 0x4b) || (bytes[0] === 0xd0 && bytes[1] === 0xcf);
  if (!excel) {
    const text = bytes.toString("utf8");
    if (!text.includes("\uFFFD")) return XLSX.read(text.replace(/^\uFEFF/, ""), { type: "string", raw: true, cellText: true });
  }
  return XLSX.read(base64, { type: "base64", raw: true, cellText: true });
}

/**
 * Read the provider file (or plan the rows read from it again, e.g. after "Add new providers" is ticked) and show
 * what Save would do. Saves nothing.
 */
export const previewProviderImport = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof previewInput>) => {
    // Said in plain words before the schema check (whose message would be a list of codes).
    if (typeof d?.base64 === "string" && d.base64.length > MAX_BASE64) throw new Error("That file is too large (up to about 9 MB).");
    return previewInput.parse(d);
  })
  .handler(async ({ data, context }): Promise<ProviderImportPreview> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    let rows: ProviderImportRow[];
    if (data.base64) {
      // Every cell as text: IDs and ZIP codes keep leading zeros and coordinates keep every digit.
      const wb = readWorkbook(data.base64);
      const sheet = wb.Sheets[wb.SheetNames.find((n) => /provider/i.test(n)) ?? wb.SheetNames[0] ?? ""];
      if (!sheet) throw new Error("The file is empty.");
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: false, raw: false });
      rows = providerRowsFromMatrix(matrix);
      if (!rows.length) throw new Error("No provider rows under the header.");
      if (rows.length > MAX_PROVIDER_ROWS) throw new Error(`Up to ${MAX_PROVIDER_ROWS.toLocaleString("en-US")} rows at a time.`);
    } else {
      rows = data.rows ?? [];
    }
    const lines = planProviderImport(rows, await loadProviders(sql), { addNew: data.addNew });
    return { rows, lines, counts: countProviderPlan(lines) };
  });

/** Postgres arrays for the address rows of one provider (one entry per address to add or change). */
function addressParams(list: AddressWrite[]): unknown[] {
  return [
    list.map((a) => a.targetId),
    list.map((a) => a.label),
    list.map((a) => a.line1),
    list.map((a) => a.city),
    list.map((a) => a.state),
    list.map((a) => a.zip),
    list.map((a) => (a.setPin ? a.latitude : null)),
    list.map((a) => (a.setPin ? a.longitude : null)),
    list.map((a) => (a.setPin ? a.quality : null)),
    list.map((a) => (a.setPin ? a.matchedAddress : null)),
    list.map((a) => a.setPin),
    list.map((a) => a.clearPin),
    list.map((a) => a.replace),
    list.map((a) => a.clearLine2),
  ];
}

const ADDRESS_VALUES = (from: number) => `
  select * from unnest($${from}::int[], $${from + 1}::text[], $${from + 2}::text[], $${from + 3}::text[], $${from + 4}::text[],
                       $${from + 5}::text[], $${from + 6}::float8[], $${from + 7}::float8[], $${from + 8}::text[],
                       $${from + 9}::text[], $${from + 10}::bool[], $${from + 11}::bool[], $${from + 12}::bool[],
                       $${from + 13}::bool[])
    as v(id, label, line1, city, state, zip, lat, lng, match, matched, set_pin, clear_pin, replace_all, clear_line2)`;

/** The keeper's blank text fields take the duplicate's value (never over a value). Column names are fixed constants. */
const FILL_SET = MERGE_FILL_FIELDS.map(([col]) => `${col} = coalesce(nullif(btrim(p.${col}), ''), d.${col})`).join(",\n              ");

/**
 * One merge, one statement: the duplicate's customer assignments move to the keeper (when the keeper already has that
 * customer the stronger role is kept and the duplicate's row is dropped); its contacts and addresses move, except the
 * copies of ones the keeper already has, which are dropped (a dropped address's pin goes onto the keeper's copy when
 * that has none); moved addresses lose a Main label (the keeper's main address stays the main one); its coverage is
 * copied (rows the keeper already has are skipped) and removed; the keeper's blank text fields (Coverage, Notes,
 * rates, …) take the duplicate's; the duplicate is archived with merged_into set, the keeper's Last Updated is set,
 * and one activity row is written. Nothing happens unless both are still on the list.
 */
async function applyMerge(sql: Sql, m: ProviderMergeWrite, who: string, today: string): Promise<boolean> {
  const res = await sql.query<{ merged: number }>(
    `with guard as (
       select d.id as dup_id, k.id as keeper_id
         from network_providers d, network_providers k
        where d.id = $1::int and k.id = $2::int and d.id <> k.id and d.archived = false and k.archived = false
     ), links as (
       select c.id, c.role, k.id as keeper_link, k.role as keeper_role
         from customer_providers c
         join guard g on c.provider_id = g.dup_id
         left join customer_providers k on k.provider_id = g.keeper_id and lower(k.customer) = lower(c.customer)
     ), stronger as (
       update customer_providers c set role = l.role, updated_at = now()
         from links l
        where c.id = l.keeper_link
          and (case l.role when 'primary' then 0 when 'secondary' then 1 else 2 end)
            < (case l.keeper_role when 'primary' then 0 when 'secondary' then 1 else 2 end)
       returning c.id
     ), dropped as (
       delete from customer_providers c using links l
        where c.id = l.id and l.keeper_link is not null
       returning c.id
     ), moved as (
       update customer_providers c set provider_id = g.keeper_id, updated_at = now()
         from links l, guard g
        where c.id = l.id and l.keeper_link is null
       returning c.id
     ), cpairs as (
       select distinct p.dup_id, p.keep_id
         from unnest($6::int[], $7::int[]) as p(dup_id, keep_id)
         join guard g on true
         join provider_contacts d on d.id = p.dup_id and d.provider_id = g.dup_id
         join provider_contacts k on k.id = p.keep_id and k.provider_id = g.keeper_id
     ), contacts_dropped as (
       delete from provider_contacts c
        where c.id in (select dup_id from cpairs)
       returning c.id
     ), contacts_role as (
       update provider_contacts k set role = d.role
         from cpairs p join provider_contacts d on d.id = p.dup_id
        where k.id = p.keep_id and coalesce(btrim(k.role), '') = '' and coalesce(btrim(d.role), '') <> ''
       returning k.id
     ), contacts as (
       update provider_contacts c set provider_id = g.keeper_id
         from guard g
        where c.provider_id = g.dup_id and c.id not in (select dup_id from cpairs)
       returning c.id
     ), apairs as (
       select distinct p.dup_id, p.keep_id
         from unnest($8::int[], $9::int[]) as p(dup_id, keep_id)
         join guard g on true
         join provider_addresses d on d.id = p.dup_id and d.provider_id = g.dup_id
         join provider_addresses k on k.id = p.keep_id and k.provider_id = g.keeper_id
     ), addresses_dropped as (
       delete from provider_addresses a
        where a.id in (select dup_id from apairs)
       returning a.id
     ), addresses_pin as (
       update provider_addresses k
          set latitude = d.latitude, longitude = d.longitude, geocode_match = d.geocode_match,
              geocode_address = d.geocode_address, geocoded_at = d.geocoded_at
         from apairs p join provider_addresses d on d.id = p.dup_id
        where k.id = p.keep_id and (k.latitude is null or k.longitude is null)
          and d.latitude is not null and d.longitude is not null
       returning k.id
     ), addresses as (
       update provider_addresses a
          set provider_id = g.keeper_id,
              label = case when lower(coalesce(a.label, '')) = 'main' then null else a.label end
         from guard g
        where a.provider_id = g.dup_id and a.id not in (select dup_id from apairs)
       returning a.id
     ), coverage_copy as (
       insert into provider_locations (provider_id, state, city, zip)
       select g.keeper_id, l.state, l.city, l.zip
         from provider_locations l join guard g on l.provider_id = g.dup_id
       on conflict do nothing
       returning id
     ), coverage_drop as (
       delete from provider_locations l using guard g
        where l.provider_id = g.dup_id
       returning l.id
     ), archived as (
       update network_providers p set archived = true, merged_into = g.keeper_id, updated_at = now()
         from guard g
        where p.id = g.dup_id
       returning p.id
     ), keeper as (
       update network_providers p
          set last_updated = $5::date, updated_at = now(),
              ${FILL_SET}
         from guard g join network_providers d on d.id = g.dup_id
        where p.id = g.keeper_id
       returning p.id
     ), act as (
       insert into activity (entity_type, entity_id, actor_name, action, detail)
       select 'provider', a.id, $3::text, 'merged', $4::text from archived a
       returning id
     )
     select (select count(*) from archived)::int as merged,
            (select count(*) from act)::int as logged,
            (select count(*) from keeper)::int as keeper,
            (select count(*) from stronger)::int + (select count(*) from dropped)::int + (select count(*) from moved)::int as links,
            (select count(*) from contacts)::int + (select count(*) from contacts_dropped)::int + (select count(*) from contacts_role)::int as contacts,
            (select count(*) from addresses)::int + (select count(*) from addresses_dropped)::int + (select count(*) from addresses_pin)::int as addresses,
            (select count(*) from coverage_copy)::int + (select count(*) from coverage_drop)::int as coverage`,
    [
      m.duplicateId,
      m.keeperId,
      who,
      m.detail,
      today,
      m.contactPairs.map((p) => p[0]),
      m.contactPairs.map((p) => p[1]),
      m.addressPairs.map((p) => p[0]),
      m.addressPairs.map((p) => p[1]),
    ],
  );
  return Number(res[0]?.merged ?? 0) === 1;
}

/**
 * One provider's update, one statement: the changed fields (blank = keep), its address rows (the main address is
 * labelled Main, any other Main label on the provider is cleared, pins saved or removed), and one activity row.
 */
async function applyUpdate(sql: Sql, u: ProviderUpdateWrite, who: string, today: string): Promise<boolean> {
  const f = u.fields;
  try {
    const res = await sql.query<{ updated: number }>(
      `with prov as (
         update network_providers set
           name = coalesce($2::text, name),
           status = coalesce($3::text, status),
           dispatch_phone = coalesce($4::text, dispatch_phone),
           dispatch_email = coalesce($5::text, dispatch_email),
           website = coalesce($6::text, website),
           coverage = coalesce($7::text, coverage),
           last_updated = $8::date,
           updated_at = now()
         where id = $1::int and archived = false
         returning id
       ), v as (${ADDRESS_VALUES(12)}
       ), clear_main as (
         update provider_addresses a set label = null
           from prov
          where $11::int is not null and a.provider_id = prov.id and lower(coalesce(a.label, '')) = 'main'
            and a.id <> $11::int and not exists (select 1 from v where v.id = a.id)
         returning a.id
       ), upd as (
         update provider_addresses a set
           label = case when v.label is not null then v.label
                        when $11::int is not null and lower(coalesce(a.label, '')) = 'main' and a.id <> $11::int then null
                        else a.label end,
           line1 = case when v.replace_all then v.line1 else coalesce(v.line1, a.line1) end,
           line2 = case when v.replace_all or v.clear_line2 then null else a.line2 end,
           city = case when v.replace_all then v.city else coalesce(v.city, a.city) end,
           state = case when v.replace_all then v.state else coalesce(v.state, a.state) end,
           zip = case when v.replace_all then v.zip else coalesce(v.zip, a.zip) end,
           latitude = case when v.set_pin then v.lat when v.clear_pin then null else a.latitude end,
           longitude = case when v.set_pin then v.lng when v.clear_pin then null else a.longitude end,
           geocode_match = case when v.set_pin then v.match when v.clear_pin then null else a.geocode_match end,
           geocode_address = case when v.set_pin then v.matched when v.clear_pin then null else a.geocode_address end,
           geocoded_at = case when v.set_pin or v.clear_pin then now() else a.geocoded_at end
           from v, prov
          where v.id is not null and a.id = v.id and a.provider_id = prov.id
         returning a.id
       ), ins as (
         insert into provider_addresses (provider_id, label, line1, city, state, zip, latitude, longitude, geocode_match, geocode_address, geocoded_at)
         select prov.id, v.label, v.line1, v.city, v.state, v.zip,
                case when v.set_pin then v.lat end, case when v.set_pin then v.lng end,
                case when v.set_pin then v.match end, case when v.set_pin then v.matched end,
                case when v.set_pin then now() end
           from v, prov
          where v.id is null
         returning id
       ), act as (
         insert into activity (entity_type, entity_id, actor_name, action, detail)
         select 'provider', prov.id, $9::text, 'updated', $10::text from prov
         returning id
       )
       select (select count(*) from prov)::int as updated, (select count(*) from act)::int as logged,
              (select count(*) from upd)::int + (select count(*) from ins)::int + (select count(*) from clear_main)::int as addresses`,
      [
        u.providerId,
        f.name ?? null,
        f.status ?? null,
        f.dispatchPhone ?? null,
        f.dispatchEmail ?? null,
        f.website ?? null,
        f.coverage ?? null,
        today,
        who,
        u.detail,
        u.mainTargetId,
        ...addressParams(u.addresses),
      ],
    );
    return Number(res[0]?.updated ?? 0) === 1;
  } catch (e) {
    if (f.name && /unique|duplicate key/i.test(e instanceof Error ? e.message : String(e))) {
      throw new Error(`Could not rename “${u.name}” to “${f.name}”: another provider already has that name. Nothing else was changed for it.`);
    }
    throw e;
  }
}

/** One new provider, one statement: the provider, its address rows with pins, and one activity row. */
async function applyCreate(sql: Sql, c: ProviderCreateWrite, who: string, today: string): Promise<boolean> {
  const f = c.fields;
  const res = await sql.query<{ id: number | null }>(
    `with prov as (
       insert into network_providers (name, status, dispatch_phone, dispatch_email, website, coverage, last_updated)
       select $1::text, $2::text, $3::text, $4::text, $5::text, $6::text, $7::date
        where not exists (select 1 from network_providers where lower(name) = lower($1::text) and archived = false)
       returning id
     ), v as (${ADDRESS_VALUES(10)}
     ), ins as (
       insert into provider_addresses (provider_id, label, line1, city, state, zip, latitude, longitude, geocode_match, geocode_address, geocoded_at)
       select prov.id, v.label, v.line1, v.city, v.state, v.zip,
              case when v.set_pin then v.lat end, case when v.set_pin then v.lng end,
              case when v.set_pin then v.match end, case when v.set_pin then v.matched end,
              case when v.set_pin then now() end
         from v, prov
       returning id
     ), act as (
       insert into activity (entity_type, entity_id, actor_name, action, detail)
       select 'provider', prov.id, $8::text, 'created', $9::text from prov
       returning id
     )
     select (select id from prov) as id, (select count(*) from ins)::int as addresses, (select count(*) from act)::int as logged`,
    [c.name, f.status ?? null, f.dispatchPhone ?? null, f.dispatchEmail ?? null, f.website ?? null, f.coverage ?? null, today, who, c.detail, ...addressParams(c.addresses)],
  );
  return res[0]?.id != null;
}

const applyInput = z.object({ rows: z.array(rowSchema).min(1).max(MAX_PROVIDER_ROWS), addNew: z.boolean().default(false) });

export type ProviderImportResult = { updated: number; merged: number; added: number; counts: ProviderPlanCounts };

/**
 * Save: plan the rows again against the providers as they are now, merge the duplicates, then plan once more (so the
 * updates see the addresses and names the merges moved or freed) and apply the updates and new providers. Each
 * provider's change is one statement. Rows under Unmatched or Conflicts write nothing.
 */
export const applyProviderImport = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof applyInput>) => applyInput.parse(d))
  .handler(async ({ data, context }): Promise<ProviderImportResult> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    const who = await actorName(sql, context.userId);
    const today = todayChicago();
    const first = planProviderImport(data.rows, await loadProviders(sql), { addNew: data.addNew });
    let merged = 0;
    for (const m of providerWrites(first).merges) if (await applyMerge(sql, m, who, today)) merged += 1;
    const second = merged ? planProviderImport(data.rows, await loadProviders(sql), { addNew: data.addNew }) : first;
    const writes = providerWrites(second);
    let updated = 0;
    let added = 0;
    for (const u of writes.updates) if (await applyUpdate(sql, u, who, today)) updated += 1;
    for (const c of writes.creates) if (await applyCreate(sql, c, who, today)) added += 1;
    return { updated, merged, added, counts: countProviderPlan(first) };
  });
