//#region src/lib/ops/rep-match.ts
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
	}
];
var PRODUCERS = DEFAULT_REPS.map((r) => r.name);
var PRODUCER_INITIALS = Object.fromEntries(DEFAULT_REPS.map((r) => [r.name, r.initials]));
var ALIASES = {};
function addAlias(raw, canonical) {
	const k = raw.trim().toLowerCase().replace(/['’]/g, "");
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
function norm(raw) {
	return (raw ?? "").trim().toLowerCase().replace(/['’]/g, "").replace(/\s+/g, " ");
}
function findRep(raw) {
	const n = norm(raw);
	if (!n) return null;
	const mapped = ALIASES[n];
	if (mapped) return DEFAULT_REPS.find((r) => r.name === mapped) ?? null;
	const stripped = n.replace(/\s*\([a-z]{2}\)\s*$/, "").trim();
	if (stripped && stripped !== n) {
		const again = ALIASES[stripped];
		if (again) return DEFAULT_REPS.find((r) => r.name === again) ?? null;
	}
	for (const r of DEFAULT_REPS) if (norm(r.name) === n || norm(r.first) === n || r.initials.toLowerCase() === n) return r;
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
	return norm(a) !== "" && norm(a) === norm(b);
}
//#endregion
export { formatRep as a, canonicalRepName as i, PRODUCERS as n, isNoRep as o, PRODUCER_INITIALS as r, sameRep as s, DEFAULT_REPS as t };
