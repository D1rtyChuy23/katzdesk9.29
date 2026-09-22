import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { renameOrMergeProvider } from "@/lib/ops/customer-identity";
import { deskMiddleware } from "@/lib/ops/access";
import { todayChicago } from "@/lib/ops/clock";
import { isoDayOrNull as isoDate } from "@/lib/ops/iso";
import {
  findDuplicateAddress,
  findDuplicateContact,
  findDuplicateLocation,
  formatAddress,
  formatContact,
  formatLocation,
  normalizeCity,
  normalizeEmail,
  normalizeState,
  normalizeZip,
  roleRank,
  splitZips,
  type AddressDraft,
  type ContactDraft,
  type CustomerProviderLink,
  type LocationDraft,
  type NetworkAccount,
  type NetworkOverview,
  type NetworkProvider,
  type ProviderAddress,
  type ProviderContact,
  type ProviderDetail,
  type ProviderDraft,
  type ProviderLocation,
  type ProviderRole,
} from "@/lib/ops/network";

async function ready() {
  const { ensureSeeded } = await import("./seed.server");
  await ensureSeeded();
  return getSql();
}

type ProviderRow = Record<string, unknown>;

function mapProvider(
  r: ProviderRow,
  extra?: { primaryFor?: number; secondaryFor?: number; states?: string[]; locationCount?: number },
): NetworkProvider {
  return {
    id: r.id as number,
    name: String(r.name),
    status: (r.status as string) ?? null,
    dispatchPhone: (r.dispatch_phone as string) ?? null,
    dispatchEmail: (r.dispatch_email as string) ?? null,
    secondaryPhone: (r.secondary_phone as string) ?? null,
    secondaryEmail: (r.secondary_email as string) ?? null,
    responseTime: (r.response_time as string) ?? null,
    standardRate: (r.standard_rate as string) ?? null,
    afterHoursRate: (r.after_hours_rate as string) ?? null,
    travelPolicy: (r.travel_policy as string) ?? null,
    equipmentServiced: (r.equipment_serviced as string) ?? null,
    coverage: (r.coverage as string) ?? null,
    contacts: (r.contacts as string) ?? null,
    pmPricing: (r.pm_pricing as string) ?? null,
    partsStocking: (r.parts_stocking as string) ?? null,
    notes: (r.notes as string) ?? null,
    lastUpdated: isoDate(r.last_updated),
    primaryFor: Number(extra?.primaryFor ?? r.primary_for ?? 0),
    secondaryFor: Number(extra?.secondaryFor ?? r.secondary_for ?? 0),
    states: extra?.states ?? [],
    locationCount: Number(extra?.locationCount ?? 0),
    updatedAt: String(r.updated_at ?? ""),
  };
}

const PROVIDER_SELECT = `
  select p.*,
    (select count(*)::int from customer_providers c where c.provider_id = p.id and c.role = 'primary') as primary_for,
    (select count(*)::int from customer_providers c where c.provider_id = p.id and c.role = 'secondary') as secondary_for
  from network_providers p
`;

export const listNetwork = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async (): Promise<NetworkOverview> => {
    const sql = await ready();
    const providerRows = await sql.query<ProviderRow>(
      `${PROVIDER_SELECT} where p.archived = false order by lower(p.name)`,
    );
    const locRows = await sql.query<{ provider_id: number; state: string }>(
      `select distinct provider_id, state from provider_locations`,
    ).catch(() => [] as { provider_id: number; state: string }[]);
    const statesBy = new Map<number, Set<string>>();
    const countBy = new Map<number, number>();
    const locCountRows = await sql.query<{ provider_id: number; c: number }>(
      `select provider_id, count(*)::int as c from provider_locations group by provider_id`,
    ).catch(() => [] as { provider_id: number; c: number }[]);
    for (const r of locRows) {
      const set = statesBy.get(r.provider_id) ?? new Set();
      set.add(r.state);
      statesBy.set(r.provider_id, set);
    }
    for (const r of locCountRows) countBy.set(r.provider_id, r.c);

    const providers = providerRows.map((r) => {
      const id = r.id as number;
      return mapProvider(r, {
        states: [...(statesBy.get(id) ?? [])].sort(),
        locationCount: countBy.get(id) ?? 0,
      });
    });
    const byId = new Map(providers.map((p) => [p.id, p]));

    const accountRows = await sql.query<{
      id: number;
      customer: string;
      email: string | null;
      contact: string | null;
      phone: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
      zip: string | null;
      equipment: string | null;
      ownership: string | null;
      region: string | null;
    }>(`select * from network_accounts order by state nulls last, lower(customer)`);

    const links = await sql.query<{ id: number; customer: string; provider_id: number; role: ProviderRole }>(
      `select id, customer, provider_id, role from customer_providers`,
    );
    const linksByCustomer = new Map<string, { id: number; role: ProviderRole; provider: NetworkProvider }[]>();
    for (const l of links) {
      const provider = byId.get(l.provider_id);
      if (!provider) continue;
      const key = l.customer.toLowerCase();
      const list = linksByCustomer.get(key) ?? [];
      list.push({ id: l.id, role: l.role, provider });
      linksByCustomer.set(key, list);
    }

    const accounts: NetworkAccount[] = accountRows.map((a) => {
      const assigned = (linksByCustomer.get(a.customer.toLowerCase()) ?? []).sort(
        (x, y) => roleRank(x.role) - roleRank(y.role),
      );
      return {
        ...a,
        primary: assigned.find((x) => x.role === "primary")?.provider ?? null,
        secondary: assigned.find((x) => x.role === "secondary")?.provider ?? null,
        extras: assigned.filter((x) => x.role === "additional").map((x) => x.provider),
      };
    });

    const stateMap = new Map<string, { total: number; unassigned: number }>();
    for (const a of accounts) {
      const state = (a.state || "—").toUpperCase();
      const cur = stateMap.get(state) ?? { total: 0, unassigned: 0 };
      cur.total += 1;
      if (!a.primary) cur.unassigned += 1;
      stateMap.set(state, cur);
    }
    const byState = [...stateMap.entries()]
      .map(([state, v]) => ({ state, ...v }))
      .sort((a, b) => a.state.localeCompare(b.state));

    return {
      providers,
      accounts,
      byState,
      unassigned: accounts.filter((a) => !a.primary),
    };
  });

function mapLocation(r: { id: number; state: string; city: string | null; zip: string | null }): ProviderLocation {
  return { id: r.id, state: r.state, city: r.city, zip: r.zip };
}

async function loadLocations(
  sql: Awaited<ReturnType<typeof ready>>,
  providerId: number,
): Promise<ProviderLocation[]> {
  const rows = await sql.query<{ id: number; state: string; city: string | null; zip: string | null }>(
    `select id, state, city, zip from provider_locations
     where provider_id = $1
     order by state, coalesce(city, ''), coalesce(zip, '')`,
    [providerId],
  );
  return rows.map(mapLocation);
}

function mapContact(r: {
  id: number;
  name: string | null;
  role: string | null;
  phone: string | null;
  email: string | null;
}): ProviderContact {
  return { id: r.id, name: r.name, role: r.role, phone: r.phone, email: r.email };
}

function mapAddress(r: {
  id: number;
  label: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}): ProviderAddress {
  return {
    id: r.id,
    label: r.label,
    line1: r.line1,
    line2: r.line2,
    city: r.city,
    state: r.state,
    zip: r.zip,
  };
}

async function loadPeople(
  sql: Awaited<ReturnType<typeof ready>>,
  providerId: number,
): Promise<ProviderContact[]> {
  const rows = await sql.query<{
    id: number;
    name: string | null;
    role: string | null;
    phone: string | null;
    email: string | null;
  }>(
    `select id, name, role, phone, email from provider_contacts
     where provider_id = $1
     order by id`,
    [providerId],
  );
  return rows.map(mapContact);
}

async function loadAddresses(
  sql: Awaited<ReturnType<typeof ready>>,
  providerId: number,
): Promise<ProviderAddress[]> {
  const rows = await sql.query<{
    id: number;
    label: string | null;
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  }>(
    `select id, label, line1, line2, city, state, zip from provider_addresses
     where provider_id = $1
     order by id`,
    [providerId],
  );
  return rows.map(mapAddress);
}

export const getProvider = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: { id: number }) => d)
  .handler(async ({ data }): Promise<ProviderDetail | null> => {
    const sql = await ready();
    const rows = await sql.query<ProviderRow>(`${PROVIDER_SELECT} where p.id = $1`, [data.id]);
    if (!rows[0] || rows[0].archived) return null;
    const accounts = await sql.query<{ customer: string; role: ProviderRole; link_id: number }>(
      `select id as link_id, customer, role from customer_providers
       where provider_id = $1
       order by case role when 'primary' then 0 when 'secondary' then 1 else 2 end, lower(customer)`,
      [data.id],
    );
    const locations = await loadLocations(sql, data.id);
    const people = await loadPeople(sql, data.id);
    const addresses = await loadAddresses(sql, data.id);
    const states = [...new Set(locations.map((l) => l.state))].sort();
    return {
      ...mapProvider(rows[0], { states, locationCount: locations.length }),
      accounts: accounts.map((a) => ({ customer: a.customer, role: a.role, linkId: a.link_id })),
      locations,
      people,
      addresses,
    };
  });

export const upsertProvider = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: ProviderDraft) => d)
  .handler(async ({ data }): Promise<NetworkProvider> => {
    const sql = await ready();
    const name = data.name.trim();
    if (!name) throw new Error("Provider name is required");
    const today = todayChicago();
    const blank = (v: string | null | undefined) => {
      const s = v?.trim();
      return s ? s : null;
    };
    if (data.id) {
      const rows = await sql`
        update network_providers set
          name = ${name},
          status = ${blank(data.status)},
          dispatch_phone = ${blank(data.dispatchPhone)},
          dispatch_email = ${blank(data.dispatchEmail)},
          secondary_phone = ${blank(data.secondaryPhone)},
          secondary_email = ${blank(data.secondaryEmail)},
          response_time = ${blank(data.responseTime)},
          standard_rate = ${blank(data.standardRate)},
          after_hours_rate = ${blank(data.afterHoursRate)},
          travel_policy = ${blank(data.travelPolicy)},
          equipment_serviced = ${blank(data.equipmentServiced)},
          coverage = ${blank(data.coverage)},
          contacts = ${blank(data.contacts)},
          pm_pricing = ${blank(data.pmPricing)},
          parts_stocking = ${blank(data.partsStocking)},
          notes = ${blank(data.notes)},
          last_updated = ${today},
          updated_at = now()
        where id = ${data.id} and archived = false
        returning *`;
      if (!rows[0]) throw new Error("Provider not found");
      if (data.locations?.length) await writeLocations(sql, data.id, data.locations);
      if (data.people?.length) await writePeople(sql, data.id, data.people);
      if (data.addresses?.length) await writeAddresses(sql, data.id, data.addresses);
      return withLocationSummary(sql, data.id);
    }
    const exists = await sql<{ id: number }>`
      select id from network_providers where lower(name) = lower(${name}) and archived = false`;
    if (exists[0]) throw new Error("A provider with that name is already on the list");
    const rows = await sql`
      insert into network_providers (
        name, status, dispatch_phone, dispatch_email, secondary_phone, secondary_email,
        response_time, standard_rate, after_hours_rate, travel_policy, equipment_serviced,
        coverage, contacts, pm_pricing, parts_stocking, notes, last_updated
      ) values (
        ${name}, ${blank(data.status)}, ${blank(data.dispatchPhone)}, ${blank(data.dispatchEmail)},
        ${blank(data.secondaryPhone)}, ${blank(data.secondaryEmail)}, ${blank(data.responseTime)},
        ${blank(data.standardRate)}, ${blank(data.afterHoursRate)}, ${blank(data.travelPolicy)},
        ${blank(data.equipmentServiced)}, ${blank(data.coverage)}, ${blank(data.contacts)},
        ${blank(data.pmPricing)}, ${blank(data.partsStocking)}, ${blank(data.notes)}, ${today}
      ) returning *`;
    const id = rows[0]!.id as number;
    if (data.locations?.length) await writeLocations(sql, id, data.locations);
    if (data.people?.length) await writePeople(sql, id, data.people);
    if (data.addresses?.length) await writeAddresses(sql, id, data.addresses);
    return withLocationSummary(sql, id);
  });

export const renameProvider = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number; name: string }) => d)
  .handler(async ({ data }) => {
    const sql = await ready();
    return renameOrMergeProvider(sql, data.id, data.name);
  });

async function writeLocations(
  sql: Awaited<ReturnType<typeof ready>>,
  providerId: number,
  drafts: LocationDraft[],
) {
  const existing = await loadLocations(sql, providerId);
  for (const d of drafts) {
    const state = normalizeState(d.state);
    if (!state) continue;
    const city = normalizeCity(d.city);
    const zip = normalizeZip(d.zip);
    if (findDuplicateLocation(existing, { state, city, zip })) continue;
    const ins = await sql<{ id: number; state: string; city: string | null; zip: string | null }>`
      insert into provider_locations (provider_id, state, city, zip)
      values (${providerId}, ${state}, ${city}, ${zip})
      returning id, state, city, zip`;
    if (ins[0]) existing.push(mapLocation(ins[0]));
  }
}

async function withLocationSummary(
  sql: Awaited<ReturnType<typeof ready>>,
  id: number,
): Promise<NetworkProvider> {
  const full = await sql.query<ProviderRow>(`${PROVIDER_SELECT} where p.id = $1`, [id]);
  const locations = await loadLocations(sql, id);
  const states = [...new Set(locations.map((l) => l.state))].sort();
  return mapProvider(full[0]!, { states, locationCount: locations.length });
}

export const addProviderLocation = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { providerId: number; state: string; city?: string | null; zip?: string | null }) => d)
  .handler(async ({ data }): Promise<{
    added: ProviderLocation[];
    duplicates: { existing: ProviderLocation; message: string }[];
  }> => {
    const sql = await ready();
    const state = normalizeState(data.state);
    if (!state) throw new Error("Pick a state");
    const city = normalizeCity(data.city);
    const zips = splitZips(data.zip ?? "") ;
    const targets: LocationDraft[] = zips.length
      ? zips.map((zip) => ({ state, city, zip }))
      : [{ state, city, zip: null }];
    const existing = await loadLocations(sql, data.providerId);
    const added: ProviderLocation[] = [];
    const duplicates: { existing: ProviderLocation; message: string }[] = [];
    for (const t of targets) {
      const dup = findDuplicateLocation(existing, t);
      if (dup) {
        duplicates.push({ existing: dup, message: `Already listed — ${formatLocation(dup)}.` });
        continue;
      }
      const ins = await sql<{ id: number; state: string; city: string | null; zip: string | null }>`
        insert into provider_locations (provider_id, state, city, zip)
        values (${data.providerId}, ${t.state}, ${t.city}, ${t.zip})
        returning id, state, city, zip`;
      if (ins[0]) {
        const loc = mapLocation(ins[0]);
        existing.push(loc);
        added.push(loc);
      }
    }
    if (added.length) {
      await sql`update network_providers set last_updated = ${todayChicago()}, updated_at = now() where id = ${data.providerId}`;
    }
    return { added, duplicates };
  });

export const removeProviderLocation = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    const sql = await ready();
    await sql`delete from provider_locations where id = ${data.id}`;
    return { ok: true as const };
  });

async function writePeople(
  sql: Awaited<ReturnType<typeof ready>>,
  providerId: number,
  drafts: ContactDraft[],
) {
  const existing = await loadPeople(sql, providerId);
  for (const d of drafts) {
    const row = {
      name: d.name?.trim() || null,
      role: d.role?.trim() || null,
      phone: d.phone?.trim() || null,
      email: normalizeEmail(d.email),
    };
    if (!row.name && !row.phone && !row.email) continue;
    if (findDuplicateContact(existing, row)) continue;
    const ins = await sql<ProviderContact>`
      insert into provider_contacts (provider_id, name, role, phone, email)
      values (${providerId}, ${row.name}, ${row.role}, ${row.phone}, ${row.email})
      returning id, name, role, phone, email`;
    if (ins[0]) existing.push(mapContact(ins[0]));
  }
}

async function writeAddresses(
  sql: Awaited<ReturnType<typeof ready>>,
  providerId: number,
  drafts: AddressDraft[],
) {
  const existing = await loadAddresses(sql, providerId);
  for (const d of drafts) {
    const row = {
      label: d.label?.trim() || null,
      line1: d.line1?.trim() || null,
      line2: d.line2?.trim() || null,
      city: normalizeCity(d.city),
      state: normalizeState(d.state),
      zip: normalizeZip(d.zip),
    };
    if (!row.line1 && !row.city) continue;
    if (findDuplicateAddress(existing, row)) continue;
    const ins = await sql<ProviderAddress>`
      insert into provider_addresses (provider_id, label, line1, line2, city, state, zip)
      values (${providerId}, ${row.label}, ${row.line1}, ${row.line2}, ${row.city}, ${row.state}, ${row.zip})
      returning id, label, line1, line2, city, state, zip`;
    if (ins[0]) existing.push(mapAddress(ins[0]));
  }
}

export const addProviderContact = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { providerId: number } & ContactDraft) => d)
  .handler(async ({ data }): Promise<{ ok: true; contact: ProviderContact } | { ok: false; duplicate: true; existing: ProviderContact; message: string }> => {
    const sql = await ready();
    const row = {
      name: data.name?.trim() || null,
      role: data.role?.trim() || null,
      phone: data.phone?.trim() || null,
      email: normalizeEmail(data.email),
    };
    if (!row.name && !row.phone && !row.email) throw new Error("Add a name, phone, or email");
    const existing = await loadPeople(sql, data.providerId);
    const dup = findDuplicateContact(existing, row);
    if (dup) {
      return { ok: false, duplicate: true, existing: dup, message: `Already listed — ${formatContact(dup)}.` };
    }
    const ins = await sql<ProviderContact>`
      insert into provider_contacts (provider_id, name, role, phone, email)
      values (${data.providerId}, ${row.name}, ${row.role}, ${row.phone}, ${row.email})
      returning id, name, role, phone, email`;
    await sql`update network_providers set last_updated = ${todayChicago()}, updated_at = now() where id = ${data.providerId}`;
    return { ok: true, contact: mapContact(ins[0]!) };
  });

export const removeProviderContact = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    const sql = await ready();
    await sql`delete from provider_contacts where id = ${data.id}`;
    return { ok: true as const };
  });

export const addProviderAddress = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { providerId: number } & AddressDraft) => d)
  .handler(async ({ data }): Promise<{ ok: true; address: ProviderAddress } | { ok: false; duplicate: true; existing: ProviderAddress; message: string }> => {
    const sql = await ready();
    const row = {
      label: data.label?.trim() || null,
      line1: data.line1?.trim() || null,
      line2: data.line2?.trim() || null,
      city: normalizeCity(data.city),
      state: normalizeState(data.state),
      zip: normalizeZip(data.zip),
    };
    if (!row.line1 && !row.city) throw new Error("Add a street or city");
    const existing = await loadAddresses(sql, data.providerId);
    const dup = findDuplicateAddress(existing, row);
    if (dup) {
      return { ok: false, duplicate: true, existing: dup, message: `Already listed — ${formatAddress(dup)}.` };
    }
    const ins = await sql<ProviderAddress>`
      insert into provider_addresses (provider_id, label, line1, line2, city, state, zip)
      values (${data.providerId}, ${row.label}, ${row.line1}, ${row.line2}, ${row.city}, ${row.state}, ${row.zip})
      returning id, label, line1, line2, city, state, zip`;
    await sql`update network_providers set last_updated = ${todayChicago()}, updated_at = now() where id = ${data.providerId}`;
    return { ok: true, address: mapAddress(ins[0]!) };
  });

export const removeProviderAddress = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    const sql = await ready();
    await sql`delete from provider_addresses where id = ${data.id}`;
    return { ok: true as const };
  });

export const archiveProvider = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    const sql = await ready();
    await sql`delete from customer_providers where provider_id = ${data.id}`;
    await sql`update network_providers set archived = true, updated_at = now() where id = ${data.id}`;
    return { ok: true as const };
  });

export const getCustomerProviders = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: { customer: string }) => d)
  .handler(async ({ data }): Promise<CustomerProviderLink[]> => {
    const customer = data.customer.trim();
    if (!customer) return [];
    const sql = await ready();
    const rows = await sql.query<ProviderRow & { link_id: number; role: ProviderRole; customer: string }>(
      `select p.*,
              (select count(*)::int from customer_providers x where x.provider_id = p.id and x.role = 'primary') as primary_for,
              (select count(*)::int from customer_providers x where x.provider_id = p.id and x.role = 'secondary') as secondary_for,
              c.id as link_id, c.customer, c.role
       from network_providers p
       join customer_providers c on c.provider_id = p.id
       where p.archived = false and lower(c.customer) = lower($1)
       order by case c.role when 'primary' then 0 when 'secondary' then 1 else 2 end, lower(p.name)`,
      [customer],
    );
    return rows.map((r) => ({
      linkId: r.link_id as number,
      customer: String(r.customer),
      role: r.role,
      provider: mapProvider(r),
    }));
  });

export const assignCustomerProvider = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { customer: string; providerId: number; role?: ProviderRole }) => d)
  .handler(async ({ data }): Promise<CustomerProviderLink> => {
    const sql = await ready();
    const customer = data.customer.trim();
    if (!customer) throw new Error("Pick a customer");
    const role: ProviderRole = data.role ?? "additional";
    const provider = await sql.query<ProviderRow>(
      `${PROVIDER_SELECT} where p.id = $1 and p.archived = false`,
      [data.providerId],
    );
    if (!provider[0]) throw new Error("Provider not found");

    await sql.query(
      `insert into directory_customers (name)
       select $1
       where not exists (select 1 from directory_customers where lower(name) = lower($1))`,
      [customer],
    );
    await sql.query(
      `insert into network_accounts (customer)
       select $1
       where not exists (select 1 from network_accounts where lower(customer) = lower($1))`,
      [customer],
    );

    if (role === "primary") {
      await sql`
        update customer_providers set role = 'additional', updated_at = now()
        where lower(customer) = lower(${customer}) and role = 'primary'`;
    } else if (role === "secondary") {
      await sql`
        update customer_providers set role = 'additional', updated_at = now()
        where lower(customer) = lower(${customer}) and role = 'secondary'`;
    }

    const existing = await sql<{ id: number }>`
      select id from customer_providers
      where provider_id = ${data.providerId} and lower(customer) = lower(${customer})`;
    let linkId: number;
    if (existing[0]) {
      await sql`update customer_providers set role = ${role}, updated_at = now() where id = ${existing[0].id}`;
      linkId = existing[0].id;
    } else {
      const ins = await sql<{ id: number }>`
        insert into customer_providers (customer, provider_id, role)
        values (${customer}, ${data.providerId}, ${role})
        returning id`;
      linkId = ins[0]!.id;
    }
    return {
      linkId,
      customer,
      role,
      provider: mapProvider(provider[0]),
    };
  });

export const unassignCustomerProvider = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { linkId: number }) => d)
  .handler(async ({ data }) => {
    const sql = await ready();
    await sql`delete from customer_providers where id = ${data.linkId}`;
    return { ok: true as const };
  });

export const setProviderRole = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { linkId: number; role: ProviderRole }) => d)
  .handler(async ({ data }) => {
    const sql = await ready();
    const cur = await sql<{ customer: string }>`
      select customer from customer_providers where id = ${data.linkId}`;
    if (!cur[0]) throw new Error("Assignment not found");
    if (data.role === "primary") {
      await sql`
        update customer_providers set role = 'additional', updated_at = now()
        where lower(customer) = lower(${cur[0].customer}) and role = 'primary' and id <> ${data.linkId}`;
    } else if (data.role === "secondary") {
      await sql`
        update customer_providers set role = 'additional', updated_at = now()
        where lower(customer) = lower(${cur[0].customer}) and role = 'secondary' and id <> ${data.linkId}`;
    }
    await sql`update customer_providers set role = ${data.role}, updated_at = now() where id = ${data.linkId}`;
    return { ok: true as const };
  });
