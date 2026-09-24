import { n as normalizeCustomerKey, t as isWalkIn } from "./customer-key.mjs";
import { a as catalogModels, c as listedEquipment, d as rewriteEquipmentName, f as samePiece, n as parseMachinesJson, r as serializeMachines } from "./machines.mjs";
//#region src/lib/ops/network.ts
var PROVIDER_STATUSES = [
	"Active",
	"Pending Setup",
	"Prospect",
	"Inactive"
];
var US_STATE_OPTIONS = [
	{
		code: "AL",
		name: "Alabama"
	},
	{
		code: "AK",
		name: "Alaska"
	},
	{
		code: "AZ",
		name: "Arizona"
	},
	{
		code: "AR",
		name: "Arkansas"
	},
	{
		code: "CA",
		name: "California"
	},
	{
		code: "CO",
		name: "Colorado"
	},
	{
		code: "CT",
		name: "Connecticut"
	},
	{
		code: "DC",
		name: "District of Columbia"
	},
	{
		code: "DE",
		name: "Delaware"
	},
	{
		code: "FL",
		name: "Florida"
	},
	{
		code: "GA",
		name: "Georgia"
	},
	{
		code: "HI",
		name: "Hawaii"
	},
	{
		code: "IA",
		name: "Iowa"
	},
	{
		code: "ID",
		name: "Idaho"
	},
	{
		code: "IL",
		name: "Illinois"
	},
	{
		code: "IN",
		name: "Indiana"
	},
	{
		code: "KS",
		name: "Kansas"
	},
	{
		code: "KY",
		name: "Kentucky"
	},
	{
		code: "LA",
		name: "Louisiana"
	},
	{
		code: "MA",
		name: "Massachusetts"
	},
	{
		code: "MD",
		name: "Maryland"
	},
	{
		code: "ME",
		name: "Maine"
	},
	{
		code: "MI",
		name: "Michigan"
	},
	{
		code: "MN",
		name: "Minnesota"
	},
	{
		code: "MO",
		name: "Missouri"
	},
	{
		code: "MS",
		name: "Mississippi"
	},
	{
		code: "MT",
		name: "Montana"
	},
	{
		code: "NC",
		name: "North Carolina"
	},
	{
		code: "ND",
		name: "North Dakota"
	},
	{
		code: "NE",
		name: "Nebraska"
	},
	{
		code: "NH",
		name: "New Hampshire"
	},
	{
		code: "NJ",
		name: "New Jersey"
	},
	{
		code: "NM",
		name: "New Mexico"
	},
	{
		code: "NV",
		name: "Nevada"
	},
	{
		code: "NY",
		name: "New York"
	},
	{
		code: "OH",
		name: "Ohio"
	},
	{
		code: "OK",
		name: "Oklahoma"
	},
	{
		code: "OR",
		name: "Oregon"
	},
	{
		code: "PA",
		name: "Pennsylvania"
	},
	{
		code: "RI",
		name: "Rhode Island"
	},
	{
		code: "SC",
		name: "South Carolina"
	},
	{
		code: "SD",
		name: "South Dakota"
	},
	{
		code: "TN",
		name: "Tennessee"
	},
	{
		code: "TX",
		name: "Texas"
	},
	{
		code: "UT",
		name: "Utah"
	},
	{
		code: "VA",
		name: "Virginia"
	},
	{
		code: "VT",
		name: "Vermont"
	},
	{
		code: "WA",
		name: "Washington"
	},
	{
		code: "WI",
		name: "Wisconsin"
	},
	{
		code: "WV",
		name: "West Virginia"
	},
	{
		code: "WY",
		name: "Wyoming"
	}
];
var STATE_CODES = new Set(US_STATE_OPTIONS.map((s) => s.code));
function normalizeState(raw) {
	const s = raw?.trim().toUpperCase() ?? "";
	return STATE_CODES.has(s) ? s : null;
}
function normalizeCity(raw) {
	const s = raw?.trim().replace(/\s+/g, " ") ?? "";
	if (!s) return null;
	return s.replace(/\b([a-z])/gi, (c) => c.toUpperCase());
}
function normalizeZip(raw) {
	const digits = (raw ?? "").replace(/\D/g, "");
	if (digits.length >= 9) return `${digits.slice(0, 5)}-${digits.slice(5, 9)}`;
	if (digits.length >= 5) return digits.slice(0, 5);
	return null;
}
function splitZips(raw) {
	if (!raw?.trim()) return [];
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	for (const part of raw.split(/[,\s]+/)) {
		const z = normalizeZip(part);
		if (z && !seen.has(z)) {
			seen.add(z);
			out.push(z);
		}
	}
	return out;
}
function locationKey(state, city, zip) {
	return `${state}|${(city ?? "").toLowerCase()}|${zip ?? ""}`;
}
function formatLocation(loc) {
	const city = loc.city?.trim();
	const zip = loc.zip?.trim();
	if (city && zip) return `${city}, ${loc.state} ${zip}`;
	if (city) return `${city}, ${loc.state}`;
	if (zip) return `${loc.state} ${zip}`;
	return `${loc.state} (statewide)`;
}
function groupLocations(locs) {
	const map = /* @__PURE__ */ new Map();
	for (const l of locs) {
		const list = map.get(l.state) ?? [];
		list.push(l);
		map.set(l.state, list);
	}
	return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([state, rows]) => ({
		state,
		rows: rows.sort((a, b) => (a.city ?? "").localeCompare(b.city ?? "") || (a.zip ?? "").localeCompare(b.zip ?? ""))
	}));
}
function findDuplicateLocation(existing, next) {
	if (next.zip) {
		const byZip = existing.find((e) => e.zip === next.zip);
		if (byZip) return byZip;
	}
	const exact = existing.find((e) => locationKey(e.state, e.city ?? null, e.zip ?? null) === locationKey(next.state, next.city, next.zip));
	if (exact) return exact;
	if (next.city) {
		const sameCity = existing.find((e) => e.state === next.state && (e.city ?? "").toLowerCase() === next.city.toLowerCase());
		if (sameCity) return sameCity;
	}
	if (!next.city && !next.zip) return existing.find((e) => e.state === next.state && !e.city && !e.zip) ?? null;
	return null;
}
function duplicateNote(existing) {
	return `Already listed — ${formatLocation(existing)}.`;
}
function parseCoverageLocations(raw) {
	if (!raw?.trim()) return [];
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	const add = (state, city, zip) => {
		const st = normalizeState(state);
		if (!st) return;
		const c = normalizeCity(city);
		const z = normalizeZip(zip);
		const k = locationKey(st, c, z);
		if (seen.has(k)) return;
		seen.add(k);
		out.push({
			state: st,
			city: c,
			zip: z
		});
	};
	let current = null;
	for (const line of raw.split(/\n|;/)) {
		const header = line.match(/\b([A-Z]{2})\s*ZIPs?:/i);
		if (header && STATE_CODES.has(header[1].toUpperCase())) current = header[1].toUpperCase();
		for (const m of line.matchAll(/([A-Za-z][A-Za-z .']{1,40}),\s*([A-Z]{2})\b/g)) {
			if (!STATE_CODES.has(m[2])) continue;
			const city = m[1].replace(/^[-–•\s]+/, "").replace(/\b(I-\d+\w*)\b/gi, "").trim();
			if (!city || city.length < 3 || STATE_CODES.has(city.toUpperCase())) {
				current = m[2];
				continue;
			}
			add(m[2], city, null);
			current = m[2];
		}
		const zips = line.match(/\b\d{5}(?:-\d{4})?\b/g) ?? [];
		for (const z of zips) add(current, null, z);
		for (const m of line.toUpperCase().matchAll(/\b([A-Z]{2})\b/g)) {
			if (!STATE_CODES.has(m[1])) continue;
			current = m[1];
			add(m[1], null, null);
		}
	}
	return out;
}
function providerStates(p) {
	if (p.states?.length) return p.states;
	return statesFromCoverage(p.coverage);
}
var US_STATES = STATE_CODES;
function statesFromCoverage(raw) {
	if (!raw) return [];
	const found = /* @__PURE__ */ new Set();
	for (const m of raw.toUpperCase().matchAll(/\b([A-Z]{2})\b/g)) if (US_STATES.has(m[1])) found.add(m[1]);
	return [...found];
}
function roleRank(role) {
	if (role === "primary") return 0;
	if (role === "secondary") return 1;
	return 2;
}
function roleLabel(role) {
	if (role === "primary") return "Primary";
	if (role === "secondary") return "Secondary";
	return "Additional";
}
function statusTone(status) {
	if (status === "Active") return "success";
	if (status === "Pending Setup" || status === "Prospect" || !status) return "warn";
	return "outline";
}
function digitsPhone(raw) {
	return (raw ?? "").replace(/\D/g, "");
}
function normalizeEmail(raw) {
	const s = raw?.trim().toLowerCase() ?? "";
	return s.includes("@") ? s : null;
}
function formatContact(c) {
	return [
		c.name,
		c.role,
		c.phone,
		c.email
	].filter(Boolean).join(" · ");
}
function formatAddress(a) {
	const body = [[a.line1, a.line2].filter(Boolean).join(", "), ([a.city, a.state].filter(Boolean).join(", ") + (a.zip ? ` ${a.zip}` : "")).trim()].filter(Boolean).join(" · ");
	return a.label ? `${a.label} — ${body}` : body;
}
function findDuplicateContact(existing, next) {
	const email = normalizeEmail(next.email);
	const phone = digitsPhone(next.phone);
	const name = next.name?.trim().toLowerCase() ?? "";
	return existing.find((e) => {
		if (email && normalizeEmail(e.email) === email) return true;
		if (phone.length >= 10 && digitsPhone(e.phone) === phone) return true;
		if (name && name === (e.name?.trim().toLowerCase() ?? "") && (email || phone.length >= 7)) return true;
		return false;
	}) ?? null;
}
function findDuplicateAddress(existing, next) {
	const line = (next.line1 ?? "").trim().toLowerCase();
	const city = (next.city ?? "").trim().toLowerCase();
	const zip = normalizeZip(next.zip) ?? "";
	const state = normalizeState(next.state) ?? "";
	return existing.find((e) => {
		const eline = (e.line1 ?? "").trim().toLowerCase();
		const ecity = (e.city ?? "").trim().toLowerCase();
		const ezip = normalizeZip(e.zip) ?? "";
		const estate = normalizeState(e.state) ?? "";
		if (zip && ezip && zip === ezip && (!line || !eline || line === eline)) return true;
		if (line && eline === line && (city === ecity || state === estate)) return true;
		if (!line && city && state && city === ecity && state === estate && zip === ezip) return true;
		return false;
	}) ?? null;
}
var STREET_HINT = /\b(st|street|ave|avenue|rd|road|ln|lane|dr|drive|blvd|way|pkwy|ct|pl|place|hwy|suite|ste|unit|pobox|p\.o\.|cir|circle)\b/i;
function parseContactBlob(raw, company) {
	if (!raw?.trim()) return {
		people: [],
		addresses: []
	};
	const companyNorm = company?.trim().toLowerCase() ?? "";
	const people = [];
	const addresses = [];
	const seenP = /* @__PURE__ */ new Set();
	const seenA = /* @__PURE__ */ new Set();
	const addPerson = (p) => {
		const name = p.name?.replace(/\s+/g, " ").trim() || null;
		if (name && companyNorm && name.toLowerCase() === companyNorm) return;
		const row = {
			name,
			role: p.role?.trim() || null,
			phone: p.phone?.trim() || null,
			email: normalizeEmail(p.email)
		};
		if (!row.name && !row.phone && !row.email) return;
		const last = people[people.length - 1];
		if (last && !row.name) {
			if (row.email && !last.email) {
				last.email = row.email;
				return;
			}
			if (row.phone && !last.phone) {
				last.phone = row.phone;
				return;
			}
		}
		const key = `${(row.name ?? "").toLowerCase()}|${digitsPhone(row.phone)}|${row.email ?? ""}`;
		if (seenP.has(key) || findDuplicateContact(people, row)) return;
		seenP.add(key);
		people.push(row);
	};
	const addAddr = (a) => {
		const row = {
			label: a.label?.trim() || null,
			line1: a.line1?.replace(/\s+/g, " ").trim() || null,
			line2: a.line2?.replace(/\s+/g, " ").trim() || null,
			city: normalizeCity(a.city),
			state: normalizeState(a.state),
			zip: normalizeZip(a.zip)
		};
		if (!row.line1 && !row.city) return;
		const key = `${(row.line1 ?? "").toLowerCase()}|${row.city ?? ""}|${row.state ?? ""}|${row.zip ?? ""}`;
		if (seenA.has(key) || findDuplicateAddress(addresses, row)) return;
		seenA.add(key);
		addresses.push(row);
	};
	const lines = raw.replace(/\r/g, "").split(/\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
	let pendingStreet = null;
	let current = {
		name: null,
		role: null,
		phone: null,
		email: null
	};
	const flushPerson = () => {
		addPerson(current);
		current = {
			name: null,
			role: null,
			phone: null,
			email: null
		};
	};
	for (const line of lines) {
		if (/^https?:|^www\./i.test(line) || /^fax:/i.test(line) || /^note:/i.test(line)) continue;
		const labeledStreet = line.match(/^(shipping address|office|warehouse|address)\s*:?\s*(.*)$/i);
		if (labeledStreet) {
			flushPerson();
			const rest = labeledStreet[2]?.trim();
			pendingStreet = rest || pendingStreet;
			if (rest && STREET_HINT.test(rest) && /^\d/.test(rest)) pendingStreet = rest;
			continue;
		}
		const cityZip = line.match(/^([A-Za-z][A-Za-z .']+),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)\b/);
		if (cityZip) {
			addAddr({
				label: null,
				line1: pendingStreet,
				line2: null,
				city: cityZip[1],
				state: cityZip[2].toUpperCase(),
				zip: cityZip[3]
			});
			pendingStreet = null;
			continue;
		}
		if (/^\d{1,6}\s+\S/.test(line) && STREET_HINT.test(line)) {
			const oneLine = line.match(/^(.*?)\s+([A-Za-z][A-Za-z .']+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/);
			if (oneLine) {
				addAddr({
					label: null,
					line1: oneLine[1].replace(/,$/, "").trim(),
					line2: null,
					city: oneLine[2],
					state: oneLine[3],
					zip: oneLine[4]
				});
				pendingStreet = null;
			} else pendingStreet = line.replace(/,$/, "");
			continue;
		}
		const emails = line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
		const phones = line.match(/(?:\+?1[-.\s])?(?:\(?\d{3}\)?[-.\s])\d{3}[-.\s]\d{4}(?:\s*(?:ext\.?|x)\s*\d+)?/gi) ?? [];
		const named = line.match(/^(?:contact|owner|name)\s*:\s*(.+)/i);
		if (named) {
			flushPerson();
			current.name = named[1].replace(/\b(phone|cell|email|mobile)\s*:.*$/i, "").trim();
			if (phones[0]) current.phone = phones[0];
			if (emails[0]) current.email = emails[0];
			continue;
		}
		const roleLine = line.match(/^(owner|president|service manager|service coordinator|director[^\d]{0,40}|cfo|manager|business development[^\d]{0,20})\s*:?\s*(.*)$/i);
		if (roleLine && !/^\d/.test(line)) {
			if (current.name && current.role) flushPerson();
			if (roleLine[2]?.trim() && !/phone|email/i.test(roleLine[2])) {
				if (!current.name) current.name = roleLine[2].trim();
				current.role = roleLine[1].trim();
			} else if (current.name) current.role = roleLine[1].trim();
			continue;
		}
		if (emails.length || phones.length) {
			if (phones[0] && !current.phone) current.phone = phones[0];
			if (emails[0] && !current.email) current.email = emails[0];
			const leftover = line.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "").replace(/(?:\+?1[-.\s])?(?:\(?\d{3}\)?[-.\s])\d{3}[-.\s]\d{4}(?:\s*(?:ext\.?|x)\s*\d+)?/gi, "").replace(/\b(phone|cell|mobile|email|office|ext\.?)\s*:?/gi, "").replace(/[|]/g, " ").trim();
			if (leftover && leftover.length > 2 && leftover.length < 48 && !current.name && !STREET_HINT.test(leftover)) current.name = leftover.replace(/^[-–•]+/, "").trim();
			if (current.name || current.email) flushPerson();
			continue;
		}
		if (line.length > 2 && line.length < 48 && !STREET_HINT.test(line) && !/^\d/.test(line) && !/phone|email|fax|www\.|http/i.test(line)) {
			if (current.name && (current.phone || current.email)) flushPerson();
			if (!current.name) current.name = line;
			else if (!current.role) current.role = line;
		}
	}
	flushPerson();
	if (pendingStreet) addAddr({
		label: null,
		line1: pendingStreet,
		line2: null,
		city: null,
		state: null,
		zip: null
	});
	return {
		people,
		addresses
	};
}
//#endregion
//#region src/lib/ops/customer-identity.ts
/** Every table that stores a customer as a name string (the join key). */
async function retargetCustomer(sql, fromRaw, toRaw) {
	const from = fromRaw.trim();
	const to = toRaw.trim();
	if (!from || !to || from.toLowerCase() === to.toLowerCase()) {
		if (from && to && from !== to) {
			await sql.query(`update service_jobs set customer = $1, updated_at = now() where lower(customer) = lower($2)`, [to, from]);
			await sql.query(`update pm_jobs set customer = $1, updated_at = now() where lower(customer) = lower($2)`, [to, from]);
			await sql.query(`update installs set customer = $1, updated_at = now() where lower(customer) = lower($2)`, [to, from]);
			await sql.query(`update deals set customer = $1, updated_at = now() where lower(customer) = lower($2)`, [to, from]);
			await sql.query(`update recipes set customer = $1 where lower(customer) = lower($2)`, [to, from]).catch(() => void 0);
			await sql.query(`update network_accounts set customer = $1, updated_at = now() where lower(customer) = lower($2)`, [to, from]).catch(() => void 0);
			await sql.query(`update customer_providers set customer = $1, updated_at = now() where lower(customer) = lower($2)`, [to, from]).catch(() => void 0);
			await sql.query(`update assets set customer_owned = $1, updated_at = now() where lower(customer_owned) = lower($2)`, [to, from]).catch(() => void 0);
			await sql.query(`update assets set sold_to = $1, updated_at = now() where lower(sold_to) = lower($2)`, [to, from]).catch(() => void 0);
			await sql.query(`update account_equipment set customer = $1, updated_at = now() where lower(customer) = lower($2)`, [to, from]).catch(() => void 0);
		}
		return;
	}
	await sql.query(`delete from customer_providers a
     using customer_providers b
     where lower(a.customer) = lower($1)
       and lower(b.customer) = lower($2)
       and a.provider_id = b.provider_id`, [from, to]).catch(() => void 0);
	await sql.query(`delete from network_accounts a
     using network_accounts b
     where lower(a.customer) = lower($1)
       and lower(b.customer) = lower($2)`, [from, to]).catch(() => void 0);
	await sql.query(`delete from recipes a
     using recipes b
     where lower(a.customer) = lower($1)
       and lower(b.customer) = lower($2)
       and lower(a.equipment_model) = lower(b.equipment_model)`, [from, to]).catch(() => void 0);
	for (const [table, col] of [
		["service_jobs", "customer"],
		["pm_jobs", "customer"],
		["installs", "customer"],
		["deals", "customer"],
		["recipes", "customer"]
	]) await sql.query(`update ${table} set ${col} = $1${table === "recipes" ? "" : ", updated_at = now()"} where lower(${col}) = lower($2)`, [to, from]).catch(async () => {
		await sql.query(`update ${table} set ${col} = $1 where lower(${col}) = lower($2)`, [to, from]);
	});
	await sql.query(`update customer_providers set customer = $1, updated_at = now() where lower(customer) = lower($2)`, [to, from]).catch(() => void 0);
	await sql.query(`update network_accounts set customer = $1, updated_at = now() where lower(customer) = lower($2)`, [to, from]).catch(() => void 0);
	await sql.query(`update assets set customer_owned = $1, updated_at = now() where lower(coalesce(customer_owned,'')) = lower($2)`, [to, from]).catch(() => void 0);
	await sql.query(`update assets set sold_to = $1, updated_at = now() where lower(coalesce(sold_to,'')) = lower($2)`, [to, from]).catch(() => void 0);
	await sql.query(`update account_equipment set customer = $1, updated_at = now() where lower(customer) = lower($2)`, [to, from]).catch(() => void 0);
}
async function renameOrMergeCustomer(sql, id, nextRaw) {
	const next = nextRaw.trim();
	if (!next) throw new Error("Customer name is empty");
	const row = (await sql.query(`select id, name, archived from directory_customers where id = $1`, [id]))[0];
	if (!row) throw new Error("Customer not found");
	if (row.name === next) return {
		id: row.id,
		name: row.name,
		merged: false
	};
	const other = await sql.query(`select id, name, archived from directory_customers where lower(name) = lower($1) and id <> $2 limit 1`, [next, id]);
	if (other[0]) {
		const keep = other[0];
		await retargetCustomer(sql, row.name, keep.name);
		await sql.query(`update directory_customers set archived = true, updated_at = now() where id = $1`, [id]);
		if (keep.archived) await sql.query(`update directory_customers set archived = false, name = $1, updated_at = now() where id = $2`, [keep.name, keep.id]);
		return {
			id: keep.id,
			name: keep.name,
			merged: true
		};
	}
	await retargetCustomer(sql, row.name, next);
	await sql.query(`update directory_customers set name = $1, archived = false, updated_at = now() where id = $2`, [next, id]);
	return {
		id,
		name: next,
		merged: false
	};
}
async function retargetEquipment(sql, fromRaw, toRaw) {
	const from = fromRaw.trim();
	const to = toRaw.trim();
	if (!from || !to) return;
	const dir = await sql.query(`select name from directory_equipment where archived = false and coalesce(name,'') <> ''`);
	const catalog = catalogModels([
		...dir.map((r) => r.name),
		from,
		to
	]);
	for (const [table, col] of [
		["service_jobs", "equipment"],
		["pm_jobs", "equipment"],
		["deals", "equipment"],
		["installs", "equipment"]
	]) {
		const rows = await sql.query(`select id, ${col} as blob from ${table}
       where ${col} is not null and ${col} <> ''
         and (lower(${col}) = lower($1) or ${col} ilike '%' || $1 || '%')`, [from]);
		for (const row of rows) {
			const next = rewriteEquipmentName(row.blob, from, to, catalog);
			if (next !== row.blob) await sql.query(`update ${table} set ${col} = $1, updated_at = now() where id = $2`, [next, row.id]).catch(async () => {
				await sql.query(`update ${table} set ${col} = $1 where id = $2`, [next, row.id]);
			});
		}
	}
	await sql.query(`update recipes set equipment_model = $1 where lower(equipment_model) = lower($2)`, [to, from]).catch(() => void 0);
	await sql.query(`update assets set model = $1, updated_at = now() where lower(model) = lower($2)`, [to, from]).catch(() => void 0);
	await sql.query(`update account_equipment set catalog_model = $1, updated_at = now() where lower(catalog_model) = lower($2)`, [to, from]).catch(() => void 0);
	const machineRows = await sql.query(`select id, machines, equipment from installs where machines is not null and machines <> ''`);
	for (const row of machineRows) {
		const specs = parseMachinesJson(row.machines);
		if (!specs.length) continue;
		let hit = false;
		const next = specs.map((s) => {
			if (!samePiece(s.equipment, from)) return s;
			hit = true;
			return {
				...s,
				equipment: to
			};
		});
		if (!hit) continue;
		const names = listedEquipment(next.map((s) => s.equipment).join("\n"), catalog);
		const packed = serializeMachines(next.map((s, i) => ({
			...s,
			equipment: names[i] ?? s.equipment
		})));
		await sql.query(`update installs set machines = $1, equipment = $2, serial = $3, power_voltage = $4, updated_at = now() where id = $5`, [
			packed.machines,
			packed.equipment,
			packed.serial,
			packed.powerVoltage,
			row.id
		]).catch(() => void 0);
	}
}
async function renameOrMergeEquipment(sql, id, nextRaw) {
	const next = nextRaw.trim();
	if (!next) throw new Error("Equipment name is empty");
	const row = (await sql.query(`select id, name, archived from directory_equipment where id = $1`, [id]))[0];
	if (!row) throw new Error("Equipment not found");
	if (row.name === next) return {
		id: row.id,
		name: row.name,
		merged: false
	};
	const other = await sql.query(`select id, name, archived from directory_equipment where lower(name) = lower($1) and id <> $2 limit 1`, [next, id]);
	if (other[0]) {
		const keep = other[0];
		await retargetEquipment(sql, row.name, keep.name);
		await sql.query(`update directory_equipment set archived = true, updated_at = now() where id = $1`, [id]);
		if (keep.archived) await sql.query(`update directory_equipment set archived = false, name = $1, updated_at = now() where id = $2`, [keep.name, keep.id]);
		return {
			id: keep.id,
			name: keep.name,
			merged: true
		};
	}
	await retargetEquipment(sql, row.name, next);
	await sql.query(`update directory_equipment set name = $1, archived = false, updated_at = now() where id = $2`, [next, id]);
	return {
		id,
		name: next,
		merged: false
	};
}
async function renameOrMergeProvider(sql, id, nextRaw) {
	const next = nextRaw.trim();
	if (!next) throw new Error("Provider name is empty");
	const row = (await sql.query(`select id, name, archived from network_providers where id = $1`, [id]))[0];
	if (!row) throw new Error("Provider not found");
	if (row.name === next) return {
		id: row.id,
		name: row.name,
		merged: false
	};
	const other = await sql.query(`select id, name, archived from network_providers where lower(name) = lower($1) and id <> $2 limit 1`, [next, id]);
	if (other[0]) {
		const keep = other[0];
		await sql.query(`delete from customer_providers a
       using customer_providers b
       where a.provider_id = $1 and b.provider_id = $2 and lower(a.customer) = lower(b.customer)`, [id, keep.id]).catch(() => void 0);
		await sql.query(`update customer_providers set provider_id = $1, updated_at = now() where provider_id = $2`, [keep.id, id]).catch(() => void 0);
		await sql.query(`delete from provider_locations a
       using provider_locations b
       where a.provider_id = $1 and b.provider_id = $2
         and a.state = b.state
         and coalesce(lower(a.city),'') = coalesce(lower(b.city),'')
         and coalesce(a.zip,'') = coalesce(b.zip,'')`, [id, keep.id]).catch(() => void 0);
		await sql.query(`update provider_locations set provider_id = $1 where provider_id = $2`, [keep.id, id]).catch(() => void 0);
		await sql.query(`update provider_contacts set provider_id = $1 where provider_id = $2`, [keep.id, id]).catch(() => void 0);
		await sql.query(`update provider_addresses set provider_id = $1 where provider_id = $2`, [keep.id, id]).catch(() => void 0);
		await sql.query(`update network_providers set archived = true, updated_at = now() where id = $1`, [id]);
		if (keep.archived) await sql.query(`update network_providers set archived = false, name = $1, updated_at = now() where id = $2`, [keep.name, keep.id]);
		return {
			id: keep.id,
			name: keep.name,
			merged: true
		};
	}
	await sql.query(`update network_providers set name = $1, archived = false, last_updated = current_date, updated_at = now() where id = $2`, [next, id]);
	return {
		id,
		name: next,
		merged: false
	};
}
//#endregion
//#region src/lib/ops/corrigo.ts
/** Corrigo report → KatzDesk tickets. Mapping only — no sales fields. */
var CORRIGO_STATUS = {
	cancelled: "Cancelled",
	canceled: "Cancelled",
	completed: "Completed",
	complete: "Completed",
	unassigned: "Open",
	"needs accepting": "Open",
	"waiting for pickup": "Open",
	"picked up": "Dispatched",
	"en route": "Dispatched",
	enroute: "Dispatched",
	"work started": "In Progress",
	paused: "In Progress",
	"on hold": "Follow-up Needed"
};
var HEADER_KEYS = {
	st: "wo",
	"st no": "wo",
	"st number": "wo",
	wo: "wo",
	"wo no": "wo",
	"work order": "wo",
	"work order number": "wo",
	"primary service tech": "technician",
	"primary tech": "technician",
	"service tech": "technician",
	technician: "technician",
	"date time completed": "completedAt",
	"date completed": "completedAt",
	"time completed": "completedAt",
	completed: "completedAt",
	"work done": "workDone",
	"operational status": "status",
	"problem description": "issue",
	problem: "issue",
	"customer name": "customer",
	customer: "customer",
	"p o": "po",
	po: "po",
	"po no": "po",
	"po number": "po",
	"call type": "callType",
	type: "callType",
	"ticket type": "callType"
};
function normalizeHeader(raw) {
	return String(raw ?? "").toLowerCase().replace(/[#]+/g, "").replace(/[./]/g, " ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
/** Remaining identity after stripping WO/ST prefixes, spaces, and hyphens. */
function woCore(raw) {
	let s = String(raw ?? "").trim().toUpperCase();
	if (!s) return "";
	s = s.replace(/[\u2010-\u2015\u2212]/g, "-");
	s = s.replace(/[\u00a0\u202f\u2007\u2009]/g, " ");
	s = s.replace(/,/g, "");
	let prev = "";
	while (s !== prev) {
		prev = s;
		s = s.replace(/^(WORK\s*ORDER|W\.?O\.?|S\.?T\.?)[#.:\s-]*/, "");
		s = s.replace(/^#/, "");
	}
	s = s.replace(/[\s-]+/g, "");
	if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, "");
	return s;
}
/** Match key: core identity, with leading zeros stripped for pure digits. */
function woMatchKey(raw) {
	const core = woCore(raw);
	if (!core) return "";
	if (/^\d+$/.test(core)) return core.replace(/^0+/, "") || "0";
	return core;
}
function woNumeric(raw) {
	const key = woMatchKey(raw ?? "");
	if (!/^\d+$/.test(key)) return null;
	const n = Number(key);
	return Number.isFinite(n) ? n : null;
}
function deskHasWrapped(hits) {
	return hits.some((h) => {
		const n = woNumeric(h.wo);
		return n != null && n >= 9999;
	});
}
var CLOSED_HIT = /* @__PURE__ */ new Set([
	"completed",
	"cancelled",
	"canceled",
	"phone resolved",
	"installed"
]);
function hitClosed(hit) {
	if (hit.done) return true;
	return CLOSED_HIT.has(String(hit.status ?? "").trim().toLowerCase());
}
/**
* After WO-9999 the 4-digit numbers start over. Don't fold a new job onto a
* closed ticket from the previous cycle when the customer doesn't match.
*/
function shouldAttachToHit(hit, fileCustomer, wrapped) {
	if (!wrapped) return true;
	const n = woNumeric(hit.wo);
	if (n == null || n > 9999) return true;
	if (!hitClosed(hit)) return true;
	if (customersCompatible(hit.customer, fileCustomer)) return true;
	return false;
}
function wrapRepeatNote(canonicalWo) {
	return `${canonicalWo} used again after 9999`;
}
/** Corrigo form stored on the ticket after a match: WO-#### */
function woCanonical(raw) {
	const core = woCore(raw);
	if (!core) return "";
	return `WO-${core}`;
}
function parseCompletedDate(raw) {
	const s = String(raw ?? "").trim();
	if (!s) return null;
	const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
	if (iso) return iso[1];
	const mdY = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
	if (mdY) {
		const month = Number(mdY[1]);
		const day = Number(mdY[2]);
		let year = Number(mdY[3]);
		if (year < 100) year += 2e3;
		if (month < 1 || month > 12 || day < 1 || day > 31) return null;
		return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
	}
	const n = Number(s);
	if (Number.isFinite(n) && n > 2e4 && n < 8e4) return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 864e5).toISOString().slice(0, 10);
	return null;
}
function statusKey(raw) {
	return raw.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}
function translateStatus(raw, completedAt) {
	const text = (raw ?? "").trim();
	if (!text) return {
		status: completedAt ? "Completed" : "Open",
		unmapped: null
	};
	const mapped = CORRIGO_STATUS[statusKey(text)];
	if (mapped) return {
		status: mapped,
		unmapped: null
	};
	return {
		status: null,
		unmapped: text
	};
}
function detectBoard(hints) {
	if (hints.existing) return hints.existing;
	const blob = [
		hints.po,
		hints.issue,
		hints.callType
	].filter(Boolean).join(" ");
	if (/\b(installs?|installation)\b/i.test(blob)) return "install";
	if (/\b(tlc|factor)\b/i.test(blob)) return "tlc";
	if (/\b(preventative|preventive|\bpm\b)\b/i.test(blob)) return "pm";
	return "service";
}
function boardLabel(board) {
	if (board === "tlc") return "TLC / Factor";
	if (board === "pm") return "PM";
	if (board === "install") return "Install";
	return null;
}
/** Same account, empty, or Walk-In — safe to fold onto one ticket. */
function customersCompatible(a, b) {
	const na = normalizeCustomerKey(a);
	const nb = normalizeCustomerKey(b);
	if (!na || !nb) return true;
	if (isWalkIn(a) || isWalkIn(b)) return true;
	return na === nb;
}
/** Starting customer on the preview picker. Walk-In stays empty unless the ticket already has a real account. */
function preferredImportCustomer(fileCustomer, existingCustomer) {
	const existing = (existingCustomer ?? "").trim() || null;
	const file = (fileCustomer ?? "").trim() || null;
	if (isWalkIn(file)) {
		if (existing && !isWalkIn(existing)) return existing;
		return null;
	}
	return file || existing;
}
function findHeaderRow(matrix) {
	let best = 0;
	let bestScore = -1;
	const limit = Math.min(matrix.length, 5);
	for (let i = 0; i < limit; i++) {
		const cols = mapHeaderRow(matrix[i] ?? []);
		const score = Object.keys(cols).length + (cols.wo != null ? 3 : 0);
		if (score > bestScore) {
			bestScore = score;
			best = i;
		}
	}
	return best;
}
function mapHeaderRow(row) {
	const cols = {};
	row.forEach((cell, i) => {
		const key = HEADER_KEYS[normalizeHeader(cell)];
		if (key && cols[key] == null) cols[key] = i;
	});
	return cols;
}
function cell(row, idx) {
	if (idx == null) return "";
	return String(row[idx] ?? "").trim();
}
function parseCorrigoMatrix(matrix) {
	if (!matrix.length) return {
		skipped: 0,
		records: []
	};
	const headerAt = findHeaderRow(matrix);
	const cols = mapHeaderRow(matrix[headerAt] ?? []);
	if (cols.wo == null) throw new Error("Could not find an ST# column. Headers can sit on row 1 or 2.");
	let skipped = 0;
	const byKey = /* @__PURE__ */ new Map();
	for (let i = headerAt + 1; i < matrix.length; i++) {
		const row = matrix[i] ?? [];
		if (row.every((c) => !String(c ?? "").trim())) continue;
		const rawWo = cell(row, cols.wo);
		const matchKey = woMatchKey(rawWo);
		if (!matchKey) {
			skipped += 1;
			continue;
		}
		byKey.set(matchKey, {
			rawWo,
			matchKey,
			canonicalWo: woCanonical(rawWo),
			technician: cell(row, cols.technician) || null,
			completedAt: parseCompletedDate(cell(row, cols.completedAt)),
			workDone: cell(row, cols.workDone) || null,
			statusRaw: cell(row, cols.status) || null,
			issue: cell(row, cols.issue) || null,
			customer: cell(row, cols.customer) || null,
			po: cell(row, cols.po) || null,
			callType: cell(row, cols.callType) || null
		});
	}
	return {
		skipped,
		records: [...byKey.values()]
	};
}
function matchNote(rawWo, canonicalWo, existingWo) {
	const compact = rawWo.trim().replace(/\s+/g, "");
	if (compact && compact.toUpperCase() !== canonicalWo.toUpperCase()) return `matched as ${compact} → ${canonicalWo}`;
	if (existingWo) {
		const existingCompact = existingWo.trim().replace(/\s+/g, "");
		if (existingCompact && existingCompact.toUpperCase() !== canonicalWo.toUpperCase()) return `matched as ${existingWo.trim()} → ${canonicalWo}`;
	}
	return null;
}
function resolvePreviewRow(rec, match, opts = {}) {
	const translated = translateStatus(rec.statusRaw, rec.completedAt);
	const wrapped = !!opts.wrapped;
	const group = [...match.unique ? [match.unique] : [], ...match.conflicts].filter((h, i, all) => all.findIndex((x) => x.board === h.board && x.id === h.id) === i);
	const hinted = detectBoard({
		po: rec.po,
		issue: rec.issue,
		callType: rec.callType
	});
	const live = group.filter((h) => !h.duplicateOf);
	const attachable = (live.length ? live : group).filter((h) => shouldAttachToHit(h, rec.customer, wrapped));
	const existing = pickKeeper(attachable.length ? attachable : [], hinted);
	const extras = existing ? group.filter((h) => h.board !== existing.board || h.id !== existing.id) : group;
	const board = detectBoard({
		po: rec.po,
		issue: rec.issue,
		callType: rec.callType,
		existing: existing?.board ?? null
	});
	const oldStatus = existing?.status ?? null;
	let newStatus;
	const statusUnmapped = translated.unmapped;
	if (translated.status) newStatus = translated.status;
	else if (oldStatus) newStatus = oldStatus;
	else newStatus = "Open";
	const siblingIds = extras.filter((h) => h.board === "service" || h.board === "tlc" || h.board === existing?.board).filter((h) => h.board === "service" || h.board === "tlc").map((c) => ({
		board: c.board,
		id: c.id
	}));
	const n = woNumeric(rec.rawWo || rec.canonicalWo);
	const wrapRepeat = wrapped && n != null && n < 5e3 && (extras.length > 0 || !existing && group.length > 0);
	const note = existing ? matchNote(rec.rawWo, rec.canonicalWo, existing.wo) : null;
	return {
		wo: rec.canonicalWo,
		rawWo: rec.rawWo,
		matchKey: rec.matchKey,
		canonicalWo: rec.canonicalWo,
		matchNote: wrapRepeat ? [note, wrapRepeatNote(rec.canonicalWo)].filter(Boolean).join(" · ") : note,
		customer: preferredImportCustomer(rec.customer, existing?.customer),
		fileCustomer: rec.customer,
		existingCustomer: existing?.customer ?? null,
		fileWalkIn: isWalkIn(rec.customer),
		action: existing ? "update" : "create",
		board,
		boardLabel: boardLabel(board),
		jobId: existing?.id ?? null,
		oldStatus,
		newStatus,
		statusUnmapped,
		technician: rec.technician,
		completedAt: rec.completedAt,
		workDone: rec.workDone,
		issue: rec.issue,
		conflictIds: siblingIds.length ? siblingIds : null,
		wrapRepeat
	};
}
/** Prefer the original ticket on the hinted board. Never skip a match — extras get flagged. */
function pickKeeper(hits, preferredBoard) {
	if (!hits.length) return null;
	const live = hits.filter((h) => !h.duplicateOf);
	const pool = live.length ? live : hits;
	const byId = (list) => [...list].sort((a, b) => a.id - b.id)[0] ?? null;
	if (preferredBoard) {
		const preferred = pool.filter((h) => h.board === preferredBoard);
		if (preferred.length) return byId(preferred);
		if (preferredBoard === "service" || preferredBoard === "tlc") {
			const serviceLike = pool.filter((h) => h.board === "service" || h.board === "tlc");
			if (serviceLike.length) return byId(serviceLike);
		}
	}
	const serviceLike = pool.filter((h) => h.board === "service" || h.board === "tlc");
	return byId(serviceLike.length ? serviceLike : pool);
}
function indexHits(hits) {
	const groups = /* @__PURE__ */ new Map();
	for (const hit of hits) {
		const key = woMatchKey(hit.wo ?? "");
		if (!key) continue;
		const list = groups.get(key) ?? [];
		if (!list.some((h) => h.board === hit.board && h.id === hit.id)) list.push(hit);
		groups.set(key, list);
	}
	const out = /* @__PURE__ */ new Map();
	for (const [key, list] of groups) {
		const keeper = pickKeeper(list);
		if (!keeper) continue;
		const extras = list.filter((h) => h.board !== keeper.board || h.id !== keeper.id);
		out.set(key, {
			unique: keeper,
			conflicts: extras
		});
	}
	return out;
}
//#endregion
//#region src/lib/ops/wo-duplicates.ts
var DUP_COLS = `
  id, kind, call_id, customer, contact, phone, equipment, issue, call_type,
  technician, wo, status, notes, work_done, completed_at, scheduled, received,
  urgency, done, duplicate_of
`;
function mergeNotes(keeper, extra) {
	const a = String(keeper ?? "").trim();
	const b = String(extra ?? "").trim();
	if (!a) return b || null;
	if (!b) return a;
	if (a.includes(b) || b.includes(a)) return a.length >= b.length ? a : b;
	return `${a}\n\n${b}`;
}
function keepFilled(keeper, extra) {
	if (String(keeper ?? "").trim()) return keeper ?? null;
	return String(extra ?? "").trim() ? extra ?? null : keeper ?? null;
}
function preferCustomer(keeper, extra) {
	const k = String(keeper ?? "").trim();
	const e = String(extra ?? "").trim();
	if (!k || isWalkIn(k)) return e || k || null;
	return k;
}
function mergeJobFields(keeper, extra) {
	const woSource = keeper.wo || extra.wo || "";
	return {
		customer: preferCustomer(keeper.customer, extra.customer),
		contact: keepFilled(keeper.contact, extra.contact),
		phone: keepFilled(keeper.phone, extra.phone),
		equipment: keepFilled(keeper.equipment, extra.equipment),
		issue: keepFilled(keeper.issue, extra.issue),
		call_type: keepFilled(keeper.call_type, extra.call_type),
		technician: keepFilled(keeper.technician, extra.technician),
		wo: woCanonical(woSource) || keeper.wo || extra.wo,
		notes: mergeNotes(keeper.notes, extra.notes),
		work_done: keepFilled(keeper.work_done, extra.work_done),
		completed_at: keepFilled(keeper.completed_at, extra.completed_at),
		scheduled: keepFilled(keeper.scheduled, extra.scheduled),
		received: keepFilled(keeper.received, extra.received),
		urgency: keepFilled(keeper.urgency, extra.urgency) || "Normal"
	};
}
async function loadJob(sql, id) {
	return (await sql.query(`select ${DUP_COLS} from service_jobs where id = $1`, [id]))[0] ?? null;
}
async function ultimateKeeper(sql, id) {
	const seen = /* @__PURE__ */ new Set();
	let row = await loadJob(sql, id);
	while (row?.duplicate_of && !seen.has(row.id)) {
		seen.add(row.id);
		row = await loadJob(sql, row.duplicate_of);
	}
	return row;
}
async function retargetThread(sql, keeper, extra) {
	await sql.query(`update comments
        set entity_type = $1, entity_id = $2
      where entity_id = $3 and entity_type in ('service', 'tlc')`, [
		keeper.kind,
		keeper.id,
		extra.id
	]);
	await sql.query(`update activity
        set entity_type = $1, entity_id = $2
      where entity_id = $3 and entity_type in ('service', 'tlc')`, [
		keeper.kind,
		keeper.id,
		extra.id
	]);
	await sql.query(`update desk_notifications
        set entity_type = $1, entity_id = $2
      where entity_id = $3 and entity_type in ('service', 'tlc')`, [
		keeper.kind,
		keeper.id,
		extra.id
	]).catch(() => void 0);
	await sql.query(`update assets set job_id = $1 where job_id = $2`, [keeper.id, extra.id]).catch(() => void 0);
}
/** Fold extra onto keeper. Notes are kept (appended if both have text). */
async function mergeServiceJobs(sql, keeperId, extraId, actor) {
	if (keeperId === extraId) return null;
	const keeper = await ultimateKeeper(sql, keeperId);
	const extra = await loadJob(sql, extraId);
	if (!keeper || !extra) return null;
	if (extra.id === keeper.id) return {
		keeperId: keeper.id,
		extraId
	};
	if (extra.duplicate_of === keeper.id) return {
		keeperId: keeper.id,
		extraId: extra.id
	};
	const next = mergeJobFields(keeper, extra);
	await sql.query(`update service_jobs set
        customer = $2, contact = $3, phone = $4, equipment = $5, issue = $6,
        call_type = $7, technician = $8, wo = $9, notes = $10, work_done = $11,
        completed_at = $12, scheduled = $13, received = $14, urgency = $15,
        updated_at = now()
      where id = $1`, [
		keeper.id,
		next.customer,
		next.contact,
		next.phone,
		next.equipment,
		next.issue,
		next.call_type,
		next.technician,
		next.wo,
		next.notes,
		next.work_done,
		next.completed_at,
		next.scheduled,
		next.received,
		next.urgency
	]);
	await retargetThread(sql, keeper, extra);
	await sql.query(`update service_jobs set duplicate_of = $2, updated_at = now() where id = $1`, [extra.id, keeper.id]);
	await sql.query(`update service_jobs set duplicate_of = $2, updated_at = now()
      where duplicate_of = $1`, [extra.id, keeper.id]);
	await sql.query(`insert into activity (entity_type, entity_id, actor_name, action, detail)
     values ($1, $2, $3, 'merged', $4)`, [
		keeper.kind,
		keeper.id,
		actor,
		`Merged #${extra.id} (${extra.call_id}) into this ticket · ${next.wo || extra.wo || ""}`.trim()
	]);
	return {
		keeperId: keeper.id,
		extraId: extra.id
	};
}
async function tryMergeServiceDuplicate(sql, keeperId, extraId, actor) {
	if (keeperId === extraId) return "skipped";
	const keeper = await ultimateKeeper(sql, keeperId);
	const extra = await loadJob(sql, extraId);
	if (!keeper || !extra || extra.id === keeper.id) return "skipped";
	if (extra.duplicate_of) return extra.duplicate_of === keeper.id ? "merged" : "skipped";
	if (customersCompatible(keeper.customer, extra.customer)) {
		await mergeServiceJobs(sql, keeper.id, extra.id, actor);
		return "merged";
	}
	return "flagged";
}
async function reconcileServiceDuplicates(sql, actor) {
	const rows = await sql.query(`select ${DUP_COLS} from service_jobs
      where coalesce(wo, '') <> '' and duplicate_of is null
      order by id`);
	const groups = /* @__PURE__ */ new Map();
	for (const row of rows) {
		const key = woMatchKey(row.wo ?? "");
		if (!key) continue;
		const list = groups.get(key) ?? [];
		list.push(row);
		groups.set(key, list);
	}
	let merged = 0;
	let flagged = 0;
	for (const list of groups.values()) {
		if (list.length < 2) continue;
		const keeper = [...list].sort((a, b) => a.id - b.id)[0];
		for (const extra of list) {
			if (extra.id === keeper.id) continue;
			const result = await tryMergeServiceDuplicate(sql, keeper.id, extra.id, actor);
			if (result === "merged") merged += 1;
			else if (result === "flagged") flagged += 1;
		}
	}
	return {
		merged,
		flagged
	};
}
//#endregion
export { normalizeZip as A, formatContact as C, normalizeCity as D, locationKey as E, roleRank as F, splitZips as I, statusTone as L, parseCoverageLocations as M, providerStates as N, normalizeEmail as O, roleLabel as P, formatAddress as S, groupLocations as T, US_STATE_OPTIONS as _, indexHits as a, findDuplicateContact as b, pickKeeper as c, woMatchKey as d, renameOrMergeCustomer as f, PROVIDER_STATUSES as g, retargetCustomer as h, deskHasWrapped as i, parseContactBlob as j, normalizeState as k, resolvePreviewRow as l, renameOrMergeProvider as m, reconcileServiceDuplicates as n, normalizeHeader as o, renameOrMergeEquipment as p, tryMergeServiceDuplicate as r, parseCorrigoMatrix as s, mergeServiceJobs as t, shouldAttachToHit as u, duplicateNote as v, formatLocation as w, findDuplicateLocation as x, findDuplicateAddress as y };
