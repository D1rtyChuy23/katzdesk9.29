import { r as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
import { p as todayChicago } from "./clock-CSFAgASg.mjs";
import { r as getSql } from "./db-DloSBs0E.mjs";
import { a as deskMiddleware } from "./access-3Tz151bB.mjs";
import { r as renameOrMergeProvider } from "./customer-identity-Dua6E4FC.mjs";
import { a as findDuplicateContact, b as roleRank, c as formatContact, f as normalizeCity, h as normalizeZip, i as findDuplicateAddress, l as formatLocation, m as normalizeState, o as findDuplicateLocation, p as normalizeEmail, s as formatAddress, x as splitZips } from "./network-feNzLxWy.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/network-api-5FCzjdhb.js
async function ready() {
	const { ensureSeeded } = await import("./seed.server-qDRWEwJF.mjs");
	await ensureSeeded();
	return getSql();
}
function isoDate(v) {
	if (v == null || v === "") return null;
	const s = String(v);
	return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
}
function mapProvider(r, extra) {
	return {
		id: r.id,
		name: String(r.name),
		status: r.status ?? null,
		dispatchPhone: r.dispatch_phone ?? null,
		dispatchEmail: r.dispatch_email ?? null,
		secondaryPhone: r.secondary_phone ?? null,
		secondaryEmail: r.secondary_email ?? null,
		responseTime: r.response_time ?? null,
		standardRate: r.standard_rate ?? null,
		afterHoursRate: r.after_hours_rate ?? null,
		travelPolicy: r.travel_policy ?? null,
		equipmentServiced: r.equipment_serviced ?? null,
		coverage: r.coverage ?? null,
		contacts: r.contacts ?? null,
		pmPricing: r.pm_pricing ?? null,
		partsStocking: r.parts_stocking ?? null,
		notes: r.notes ?? null,
		lastUpdated: isoDate(r.last_updated),
		primaryFor: Number(extra?.primaryFor ?? r.primary_for ?? 0),
		secondaryFor: Number(extra?.secondaryFor ?? r.secondary_for ?? 0),
		states: extra?.states ?? [],
		locationCount: Number(extra?.locationCount ?? 0),
		updatedAt: String(r.updated_at ?? "")
	};
}
var PROVIDER_SELECT = `
  select p.*,
    (select count(*)::int from customer_providers c where c.provider_id = p.id and c.role = 'primary') as primary_for,
    (select count(*)::int from customer_providers c where c.provider_id = p.id and c.role = 'secondary') as secondary_for
  from network_providers p
`;
var listNetwork_createServerFn_handler = createServerRpc({
	id: "0e70cec8a743027415d0460951e6e2bb501309027c1759c4c98cfd78df7764d5",
	name: "listNetwork",
	filename: "src/lib/ops/network-api.ts"
}, (opts) => listNetwork.__executeServer(opts));
var listNetwork = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(listNetwork_createServerFn_handler, async () => {
	const sql = await ready();
	const providerRows = await sql.query(`${PROVIDER_SELECT} where p.archived = false order by lower(p.name)`);
	const locRows = await sql.query(`select distinct provider_id, state from provider_locations`).catch(() => []);
	const statesBy = /* @__PURE__ */ new Map();
	const countBy = /* @__PURE__ */ new Map();
	const locCountRows = await sql.query(`select provider_id, count(*)::int as c from provider_locations group by provider_id`).catch(() => []);
	for (const r of locRows) {
		const set = statesBy.get(r.provider_id) ?? /* @__PURE__ */ new Set();
		set.add(r.state);
		statesBy.set(r.provider_id, set);
	}
	for (const r of locCountRows) countBy.set(r.provider_id, r.c);
	const providers = providerRows.map((r) => {
		const id = r.id;
		return mapProvider(r, {
			states: [...statesBy.get(id) ?? []].sort(),
			locationCount: countBy.get(id) ?? 0
		});
	});
	const byId = new Map(providers.map((p) => [p.id, p]));
	const accountRows = await sql.query(`select * from network_accounts order by state nulls last, lower(customer)`);
	const links = await sql.query(`select id, customer, provider_id, role from customer_providers`);
	const linksByCustomer = /* @__PURE__ */ new Map();
	for (const l of links) {
		const provider = byId.get(l.provider_id);
		if (!provider) continue;
		const key = l.customer.toLowerCase();
		const list = linksByCustomer.get(key) ?? [];
		list.push({
			id: l.id,
			role: l.role,
			provider
		});
		linksByCustomer.set(key, list);
	}
	const accounts = accountRows.map((a) => {
		const assigned = (linksByCustomer.get(a.customer.toLowerCase()) ?? []).sort((x, y) => roleRank(x.role) - roleRank(y.role));
		return {
			...a,
			primary: assigned.find((x) => x.role === "primary")?.provider ?? null,
			secondary: assigned.find((x) => x.role === "secondary")?.provider ?? null,
			extras: assigned.filter((x) => x.role === "additional").map((x) => x.provider)
		};
	});
	const stateMap = /* @__PURE__ */ new Map();
	for (const a of accounts) {
		const state = (a.state || "—").toUpperCase();
		const cur = stateMap.get(state) ?? {
			total: 0,
			unassigned: 0
		};
		cur.total += 1;
		if (!a.primary) cur.unassigned += 1;
		stateMap.set(state, cur);
	}
	return {
		providers,
		accounts,
		byState: [...stateMap.entries()].map(([state, v]) => ({
			state,
			...v
		})).sort((a, b) => a.state.localeCompare(b.state)),
		unassigned: accounts.filter((a) => !a.primary)
	};
});
function mapLocation(r) {
	return {
		id: r.id,
		state: r.state,
		city: r.city,
		zip: r.zip
	};
}
async function loadLocations(sql, providerId) {
	return (await sql.query(`select id, state, city, zip from provider_locations
     where provider_id = $1
     order by state, coalesce(city, ''), coalesce(zip, '')`, [providerId])).map(mapLocation);
}
function mapContact(r) {
	return {
		id: r.id,
		name: r.name,
		role: r.role,
		phone: r.phone,
		email: r.email
	};
}
function mapAddress(r) {
	return {
		id: r.id,
		label: r.label,
		line1: r.line1,
		line2: r.line2,
		city: r.city,
		state: r.state,
		zip: r.zip
	};
}
async function loadPeople(sql, providerId) {
	return (await sql.query(`select id, name, role, phone, email from provider_contacts
     where provider_id = $1
     order by id`, [providerId])).map(mapContact);
}
async function loadAddresses(sql, providerId) {
	return (await sql.query(`select id, label, line1, line2, city, state, zip from provider_addresses
     where provider_id = $1
     order by id`, [providerId])).map(mapAddress);
}
var getProvider_createServerFn_handler = createServerRpc({
	id: "6e67d51c0c64562bbed03eea6fbb1e7c689b83ef33496797ea9f1a8a23c70aa9",
	name: "getProvider",
	filename: "src/lib/ops/network-api.ts"
}, (opts) => getProvider.__executeServer(opts));
var getProvider = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(getProvider_createServerFn_handler, async ({ data }) => {
	const sql = await ready();
	const rows = await sql.query(`${PROVIDER_SELECT} where p.id = $1`, [data.id]);
	if (!rows[0] || rows[0].archived) return null;
	const accounts = await sql.query(`select id as link_id, customer, role from customer_providers
       where provider_id = $1
       order by case role when 'primary' then 0 when 'secondary' then 1 else 2 end, lower(customer)`, [data.id]);
	const locations = await loadLocations(sql, data.id);
	const people = await loadPeople(sql, data.id);
	const addresses = await loadAddresses(sql, data.id);
	const states = [...new Set(locations.map((l) => l.state))].sort();
	return {
		...mapProvider(rows[0], {
			states,
			locationCount: locations.length
		}),
		accounts: accounts.map((a) => ({
			customer: a.customer,
			role: a.role,
			linkId: a.link_id
		})),
		locations,
		people,
		addresses
	};
});
var upsertProvider_createServerFn_handler = createServerRpc({
	id: "f62afaeae21ab0e89d7d27769b2f5064cb3e75f64a9ea65009068831d0434921",
	name: "upsertProvider",
	filename: "src/lib/ops/network-api.ts"
}, (opts) => upsertProvider.__executeServer(opts));
var upsertProvider = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(upsertProvider_createServerFn_handler, async ({ data }) => {
	const sql = await ready();
	const name = data.name.trim();
	if (!name) throw new Error("Provider name is required");
	const today = todayChicago();
	const blank = (v) => {
		const s = v?.trim();
		return s ? s : null;
	};
	if (data.id) {
		if (!(await sql`
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
        returning *`)[0]) throw new Error("Provider not found");
		if (data.locations?.length) await writeLocations(sql, data.id, data.locations);
		if (data.people?.length) await writePeople(sql, data.id, data.people);
		if (data.addresses?.length) await writeAddresses(sql, data.id, data.addresses);
		return withLocationSummary(sql, data.id);
	}
	if ((await sql`
      select id from network_providers where lower(name) = lower(${name}) and archived = false`)[0]) throw new Error("A provider with that name is already on the list");
	const id = (await sql`
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
      ) returning *`)[0].id;
	if (data.locations?.length) await writeLocations(sql, id, data.locations);
	if (data.people?.length) await writePeople(sql, id, data.people);
	if (data.addresses?.length) await writeAddresses(sql, id, data.addresses);
	return withLocationSummary(sql, id);
});
var renameProvider_createServerFn_handler = createServerRpc({
	id: "5272252cb350fffbd8b8d56c4ef404ee93249ca615f69b19500c65e08ca968d3",
	name: "renameProvider",
	filename: "src/lib/ops/network-api.ts"
}, (opts) => renameProvider.__executeServer(opts));
var renameProvider = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(renameProvider_createServerFn_handler, async ({ data }) => {
	const sql = await ready();
	return renameOrMergeProvider(sql, data.id, data.name);
});
async function writeLocations(sql, providerId, drafts) {
	const existing = await loadLocations(sql, providerId);
	for (const d of drafts) {
		const state = normalizeState(d.state);
		if (!state) continue;
		const city = normalizeCity(d.city);
		const zip = normalizeZip(d.zip);
		if (findDuplicateLocation(existing, {
			state,
			city,
			zip
		})) continue;
		const ins = await sql`
      insert into provider_locations (provider_id, state, city, zip)
      values (${providerId}, ${state}, ${city}, ${zip})
      returning id, state, city, zip`;
		if (ins[0]) existing.push(mapLocation(ins[0]));
	}
}
async function withLocationSummary(sql, id) {
	const full = await sql.query(`${PROVIDER_SELECT} where p.id = $1`, [id]);
	const locations = await loadLocations(sql, id);
	const states = [...new Set(locations.map((l) => l.state))].sort();
	return mapProvider(full[0], {
		states,
		locationCount: locations.length
	});
}
var addProviderLocation_createServerFn_handler = createServerRpc({
	id: "7d30dfaa7a40d51c27cd0ce998e25cfeded40af2ff16826301ad1363906ce978",
	name: "addProviderLocation",
	filename: "src/lib/ops/network-api.ts"
}, (opts) => addProviderLocation.__executeServer(opts));
var addProviderLocation = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(addProviderLocation_createServerFn_handler, async ({ data }) => {
	const sql = await ready();
	const state = normalizeState(data.state);
	if (!state) throw new Error("Pick a state");
	const city = normalizeCity(data.city);
	const zips = splitZips(data.zip ?? "");
	const targets = zips.length ? zips.map((zip) => ({
		state,
		city,
		zip
	})) : [{
		state,
		city,
		zip: null
	}];
	const existing = await loadLocations(sql, data.providerId);
	const added = [];
	const duplicates = [];
	for (const t of targets) {
		const dup = findDuplicateLocation(existing, t);
		if (dup) {
			duplicates.push({
				existing: dup,
				message: `Already listed — ${formatLocation(dup)}.`
			});
			continue;
		}
		const ins = await sql`
        insert into provider_locations (provider_id, state, city, zip)
        values (${data.providerId}, ${t.state}, ${t.city}, ${t.zip})
        returning id, state, city, zip`;
		if (ins[0]) {
			const loc = mapLocation(ins[0]);
			existing.push(loc);
			added.push(loc);
		}
	}
	if (added.length) await sql`update network_providers set last_updated = ${todayChicago()}, updated_at = now() where id = ${data.providerId}`;
	return {
		added,
		duplicates
	};
});
var removeProviderLocation_createServerFn_handler = createServerRpc({
	id: "d542ae756f2e6694dce801180f201b4d169c51d7a4538e3133a8696e2e25728c",
	name: "removeProviderLocation",
	filename: "src/lib/ops/network-api.ts"
}, (opts) => removeProviderLocation.__executeServer(opts));
var removeProviderLocation = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(removeProviderLocation_createServerFn_handler, async ({ data }) => {
	await (await ready())`delete from provider_locations where id = ${data.id}`;
	return { ok: true };
});
async function writePeople(sql, providerId, drafts) {
	const existing = await loadPeople(sql, providerId);
	for (const d of drafts) {
		const row = {
			name: d.name?.trim() || null,
			role: d.role?.trim() || null,
			phone: d.phone?.trim() || null,
			email: normalizeEmail(d.email)
		};
		if (!row.name && !row.phone && !row.email) continue;
		if (findDuplicateContact(existing, row)) continue;
		const ins = await sql`
      insert into provider_contacts (provider_id, name, role, phone, email)
      values (${providerId}, ${row.name}, ${row.role}, ${row.phone}, ${row.email})
      returning id, name, role, phone, email`;
		if (ins[0]) existing.push(mapContact(ins[0]));
	}
}
async function writeAddresses(sql, providerId, drafts) {
	const existing = await loadAddresses(sql, providerId);
	for (const d of drafts) {
		const row = {
			label: d.label?.trim() || null,
			line1: d.line1?.trim() || null,
			line2: d.line2?.trim() || null,
			city: normalizeCity(d.city),
			state: normalizeState(d.state),
			zip: normalizeZip(d.zip)
		};
		if (!row.line1 && !row.city) continue;
		if (findDuplicateAddress(existing, row)) continue;
		const ins = await sql`
      insert into provider_addresses (provider_id, label, line1, line2, city, state, zip)
      values (${providerId}, ${row.label}, ${row.line1}, ${row.line2}, ${row.city}, ${row.state}, ${row.zip})
      returning id, label, line1, line2, city, state, zip`;
		if (ins[0]) existing.push(mapAddress(ins[0]));
	}
}
var addProviderContact_createServerFn_handler = createServerRpc({
	id: "f2825516656623b695881938cec0b6cf9876e9c7c29a937a8cdcbfa5be64c879",
	name: "addProviderContact",
	filename: "src/lib/ops/network-api.ts"
}, (opts) => addProviderContact.__executeServer(opts));
var addProviderContact = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(addProviderContact_createServerFn_handler, async ({ data }) => {
	const sql = await ready();
	const row = {
		name: data.name?.trim() || null,
		role: data.role?.trim() || null,
		phone: data.phone?.trim() || null,
		email: normalizeEmail(data.email)
	};
	if (!row.name && !row.phone && !row.email) throw new Error("Add a name, phone, or email");
	const existing = await loadPeople(sql, data.providerId);
	const dup = findDuplicateContact(existing, row);
	if (dup) return {
		ok: false,
		duplicate: true,
		existing: dup,
		message: `Already listed — ${formatContact(dup)}.`
	};
	const ins = await sql`
      insert into provider_contacts (provider_id, name, role, phone, email)
      values (${data.providerId}, ${row.name}, ${row.role}, ${row.phone}, ${row.email})
      returning id, name, role, phone, email`;
	await sql`update network_providers set last_updated = ${todayChicago()}, updated_at = now() where id = ${data.providerId}`;
	return {
		ok: true,
		contact: mapContact(ins[0])
	};
});
var removeProviderContact_createServerFn_handler = createServerRpc({
	id: "a534ea58c5fe888eb5efb486c3893ae8da4fdc6fa69c93aee3dab0efe6f088fa",
	name: "removeProviderContact",
	filename: "src/lib/ops/network-api.ts"
}, (opts) => removeProviderContact.__executeServer(opts));
var removeProviderContact = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(removeProviderContact_createServerFn_handler, async ({ data }) => {
	await (await ready())`delete from provider_contacts where id = ${data.id}`;
	return { ok: true };
});
var addProviderAddress_createServerFn_handler = createServerRpc({
	id: "382dd0efa33ba73974579c8835f506ae0d04e33a2a6b5c2df3a7598f86087361",
	name: "addProviderAddress",
	filename: "src/lib/ops/network-api.ts"
}, (opts) => addProviderAddress.__executeServer(opts));
var addProviderAddress = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(addProviderAddress_createServerFn_handler, async ({ data }) => {
	const sql = await ready();
	const row = {
		label: data.label?.trim() || null,
		line1: data.line1?.trim() || null,
		line2: data.line2?.trim() || null,
		city: normalizeCity(data.city),
		state: normalizeState(data.state),
		zip: normalizeZip(data.zip)
	};
	if (!row.line1 && !row.city) throw new Error("Add a street or city");
	const existing = await loadAddresses(sql, data.providerId);
	const dup = findDuplicateAddress(existing, row);
	if (dup) return {
		ok: false,
		duplicate: true,
		existing: dup,
		message: `Already listed — ${formatAddress(dup)}.`
	};
	const ins = await sql`
      insert into provider_addresses (provider_id, label, line1, line2, city, state, zip)
      values (${data.providerId}, ${row.label}, ${row.line1}, ${row.line2}, ${row.city}, ${row.state}, ${row.zip})
      returning id, label, line1, line2, city, state, zip`;
	await sql`update network_providers set last_updated = ${todayChicago()}, updated_at = now() where id = ${data.providerId}`;
	return {
		ok: true,
		address: mapAddress(ins[0])
	};
});
var removeProviderAddress_createServerFn_handler = createServerRpc({
	id: "91a2ebe1261556f11fcc6a931cb07fb974490d2efb9a57f84f4b4edd6b44fd73",
	name: "removeProviderAddress",
	filename: "src/lib/ops/network-api.ts"
}, (opts) => removeProviderAddress.__executeServer(opts));
var removeProviderAddress = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(removeProviderAddress_createServerFn_handler, async ({ data }) => {
	await (await ready())`delete from provider_addresses where id = ${data.id}`;
	return { ok: true };
});
var archiveProvider_createServerFn_handler = createServerRpc({
	id: "471944d55e1c65b4213049ee898d032a581f48ae35180995f970ee884a74ec4a",
	name: "archiveProvider",
	filename: "src/lib/ops/network-api.ts"
}, (opts) => archiveProvider.__executeServer(opts));
var archiveProvider = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(archiveProvider_createServerFn_handler, async ({ data }) => {
	const sql = await ready();
	await sql`delete from customer_providers where provider_id = ${data.id}`;
	await sql`update network_providers set archived = true, updated_at = now() where id = ${data.id}`;
	return { ok: true };
});
var getCustomerProviders_createServerFn_handler = createServerRpc({
	id: "683ce4e118843b9882fa4d3ef4aae93e7c9911c090294ea307f851a3f443ba3b",
	name: "getCustomerProviders",
	filename: "src/lib/ops/network-api.ts"
}, (opts) => getCustomerProviders.__executeServer(opts));
var getCustomerProviders = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(getCustomerProviders_createServerFn_handler, async ({ data }) => {
	const customer = data.customer.trim();
	if (!customer) return [];
	return (await (await ready()).query(`select p.*,
              (select count(*)::int from customer_providers x where x.provider_id = p.id and x.role = 'primary') as primary_for,
              (select count(*)::int from customer_providers x where x.provider_id = p.id and x.role = 'secondary') as secondary_for,
              c.id as link_id, c.customer, c.role
       from network_providers p
       join customer_providers c on c.provider_id = p.id
       where p.archived = false and lower(c.customer) = lower($1)
       order by case c.role when 'primary' then 0 when 'secondary' then 1 else 2 end, lower(p.name)`, [customer])).map((r) => ({
		linkId: r.link_id,
		customer: String(r.customer),
		role: r.role,
		provider: mapProvider(r)
	}));
});
var assignCustomerProvider_createServerFn_handler = createServerRpc({
	id: "2808eee236ac8a01d9b5df827bec7737d82a7b482025f6f1765ce51c74d36ecf",
	name: "assignCustomerProvider",
	filename: "src/lib/ops/network-api.ts"
}, (opts) => assignCustomerProvider.__executeServer(opts));
var assignCustomerProvider = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(assignCustomerProvider_createServerFn_handler, async ({ data }) => {
	const sql = await ready();
	const customer = data.customer.trim();
	if (!customer) throw new Error("Pick a customer");
	const role = data.role ?? "additional";
	const provider = await sql.query(`${PROVIDER_SELECT} where p.id = $1 and p.archived = false`, [data.providerId]);
	if (!provider[0]) throw new Error("Provider not found");
	await sql.query(`insert into directory_customers (name)
       select $1
       where not exists (select 1 from directory_customers where lower(name) = lower($1))`, [customer]);
	await sql.query(`insert into network_accounts (customer)
       select $1
       where not exists (select 1 from network_accounts where lower(customer) = lower($1))`, [customer]);
	if (role === "primary") await sql`
        update customer_providers set role = 'additional', updated_at = now()
        where lower(customer) = lower(${customer}) and role = 'primary'`;
	else if (role === "secondary") await sql`
        update customer_providers set role = 'additional', updated_at = now()
        where lower(customer) = lower(${customer}) and role = 'secondary'`;
	const existing = await sql`
      select id from customer_providers
      where provider_id = ${data.providerId} and lower(customer) = lower(${customer})`;
	let linkId;
	if (existing[0]) {
		await sql`update customer_providers set role = ${role}, updated_at = now() where id = ${existing[0].id}`;
		linkId = existing[0].id;
	} else linkId = (await sql`
        insert into customer_providers (customer, provider_id, role)
        values (${customer}, ${data.providerId}, ${role})
        returning id`)[0].id;
	return {
		linkId,
		customer,
		role,
		provider: mapProvider(provider[0])
	};
});
var unassignCustomerProvider_createServerFn_handler = createServerRpc({
	id: "459028e7e9941b4f9e5d3cb9f2219c189d90cc6b094ae31d8cfcbce57606b7ed",
	name: "unassignCustomerProvider",
	filename: "src/lib/ops/network-api.ts"
}, (opts) => unassignCustomerProvider.__executeServer(opts));
var unassignCustomerProvider = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(unassignCustomerProvider_createServerFn_handler, async ({ data }) => {
	await (await ready())`delete from customer_providers where id = ${data.linkId}`;
	return { ok: true };
});
var setProviderRole_createServerFn_handler = createServerRpc({
	id: "e1f6b5e1ee21f932bd78b1ddbf8e596c45e7296aac8591d390fcd0ce141b2d8c",
	name: "setProviderRole",
	filename: "src/lib/ops/network-api.ts"
}, (opts) => setProviderRole.__executeServer(opts));
var setProviderRole = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(setProviderRole_createServerFn_handler, async ({ data }) => {
	const sql = await ready();
	const cur = await sql`
      select customer from customer_providers where id = ${data.linkId}`;
	if (!cur[0]) throw new Error("Assignment not found");
	if (data.role === "primary") await sql`
        update customer_providers set role = 'additional', updated_at = now()
        where lower(customer) = lower(${cur[0].customer}) and role = 'primary' and id <> ${data.linkId}`;
	else if (data.role === "secondary") await sql`
        update customer_providers set role = 'additional', updated_at = now()
        where lower(customer) = lower(${cur[0].customer}) and role = 'secondary' and id <> ${data.linkId}`;
	await sql`update customer_providers set role = ${data.role}, updated_at = now() where id = ${data.linkId}`;
	return { ok: true };
});
//#endregion
export { addProviderAddress_createServerFn_handler, addProviderContact_createServerFn_handler, addProviderLocation_createServerFn_handler, archiveProvider_createServerFn_handler, assignCustomerProvider_createServerFn_handler, getCustomerProviders_createServerFn_handler, getProvider_createServerFn_handler, listNetwork_createServerFn_handler, removeProviderAddress_createServerFn_handler, removeProviderContact_createServerFn_handler, removeProviderLocation_createServerFn_handler, renameProvider_createServerFn_handler, setProviderRole_createServerFn_handler, unassignCustomerProvider_createServerFn_handler, upsertProvider_createServerFn_handler };
