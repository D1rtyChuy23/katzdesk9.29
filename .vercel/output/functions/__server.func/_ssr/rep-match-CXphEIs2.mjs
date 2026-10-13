import { t as normalizeName } from "./norm-_aMMQVT6.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/rep-match-CXphEIs2.js
/** Locked sales-rep list. Display as Name (IN). */
var DEFAULT_REPS = [
	{
		name: "Amanda Logg",
		initials: "AL",
		first: "Amanda"
	},
	{
		name: "Lizbeth Romero",
		initials: "LR",
		first: "Lizbeth"
	},
	{
		name: "Sean Marshall",
		initials: "SM",
		first: "Sean"
	},
	{
		name: "Lance Oden",
		initials: "LO",
		first: "Lance"
	},
	{
		name: "Bill McKinley",
		initials: "BM",
		first: "Bill"
	},
	{
		name: "Shannon Cafourek",
		initials: "SC",
		first: "Shannon"
	},
	{
		name: "Jesus Garcia",
		initials: "JG",
		first: "Jesus"
	},
	{
		name: "Melinda Warden",
		initials: "MW",
		first: "Melinda"
	}
];
var PRODUCERS = DEFAULT_REPS.map((r) => r.name);
var PRODUCER_INITIALS = Object.fromEntries(DEFAULT_REPS.map((r) => [r.name, r.initials]));
var ALIASES = {};
function addAlias(raw, canonical) {
	const k = normalizeName(raw);
	if (k) ALIASES[k] = canonical;
}
for (const r of DEFAULT_REPS) {
	addAlias(r.name, r.name);
	addAlias(r.first, r.name);
	addAlias(r.initials, r.name);
	addAlias(`${r.first} ${r.initials}`, r.name);
	addAlias(`${r.name} (${r.initials})`, r.name);
}
addAlias("McKinley", "Bill McKinley");
addAlias("McKinsley", "Bill McKinley");
addAlias("Bill McKinsley", "Bill McKinley");
addAlias("Bill McKinley", "Bill McKinley");
addAlias("Warden", "Melinda Warden");
function findRep(raw) {
	const n = normalizeName(raw);
	if (!n) return null;
	const mapped = ALIASES[n];
	if (mapped) return DEFAULT_REPS.find((r) => r.name === mapped) ?? null;
	const stripped = n.replace(/\s*\([a-z]{2}\)\s*$/, "").trim();
	if (stripped && stripped !== n) {
		const again = ALIASES[stripped];
		if (again) return DEFAULT_REPS.find((r) => r.name === again) ?? null;
	}
	for (const r of DEFAULT_REPS) if (normalizeName(r.name) === n || normalizeName(r.first) === n || r.initials.toLowerCase() === n) return r;
	return null;
}
function canonicalRepName(raw) {
	return findRep(raw)?.name ?? null;
}
function isNoRep(raw) {
	return !findRep(raw);
}
function formatRep(raw) {
	const r = findRep(raw);
	if (r) return `${r.name} (${r.initials})`;
	return (raw ?? "").trim() || "";
}
function sameRep(a, b) {
	const left = canonicalRepName(a);
	const right = canonicalRepName(b);
	if (left && right) return left === right;
	return normalizeName(a) !== "" && normalizeName(a) === normalizeName(b);
}
//#endregion
export { findRep as a, sameRep as c, canonicalRepName as i, PRODUCERS as n, formatRep as o, PRODUCER_INITIALS as r, isNoRep as s, DEFAULT_REPS as t };
