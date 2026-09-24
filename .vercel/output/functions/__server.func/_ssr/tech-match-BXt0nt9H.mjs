import { t as normalizeName } from "./norm-_aMMQVT6.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/tech-match-BXt0nt9H.js
/** Corrigo-spelled service techs. Display names on the roster dropdown. */
var DEFAULT_TECHS = [
	"Ryan Gloria",
	"Charles Foster",
	"Oliver Garcia",
	"Joshua Harper",
	"Lance Oden",
	"Jesus Garcia",
	"Bill McKinley",
	"Brandon Chappell",
	"3rd Party"
];
var ALIASES = {};
function addAlias(raw, canonical) {
	const k = normalizeName(raw);
	if (k) ALIASES[k] = canonical;
}
var firstCounts = /* @__PURE__ */ new Map();
var lastCounts = /* @__PURE__ */ new Map();
for (const name of DEFAULT_TECHS) {
	if (name === "3rd Party") continue;
	const parts = name.split(/\s+/);
	const first = parts[0].toLowerCase();
	const last = parts[parts.length - 1].toLowerCase();
	firstCounts.set(first, (firstCounts.get(first) ?? 0) + 1);
	lastCounts.set(last, (lastCounts.get(last) ?? 0) + 1);
}
for (const name of DEFAULT_TECHS) {
	addAlias(name, name);
	if (name === "3rd Party") continue;
	const parts = name.split(/\s+/);
	const first = parts[0];
	const last = parts[parts.length - 1];
	if ((firstCounts.get(first.toLowerCase()) ?? 0) === 1) addAlias(first, name);
	if (last !== first && (lastCounts.get(last.toLowerCase()) ?? 0) === 1) addAlias(last, name);
}
addAlias("Josh", "Joshua Harper");
addAlias("Joshua", "Joshua Harper");
addAlias("McKinsley", "Bill McKinley");
addAlias("Bill McKinsley", "Bill McKinley");
addAlias("third party", "3rd Party");
addAlias("3rd", "3rd Party");
addAlias("3rd-party", "3rd Party");
/** Map a stored/typed spelling to the Corrigo roster name when unique. */
function canonicalTechName(raw) {
	const k = normalizeName(raw);
	if (!k) return null;
	return ALIASES[k] ?? null;
}
/** True when two technician strings are the same person (aliases included). */
function sameTech(a, b) {
	const na = normalizeName(a);
	const nb = normalizeName(b);
	if (!na || !nb) return false;
	if (na === nb) return true;
	const ca = canonicalTechName(a);
	const cb = canonicalTechName(b);
	if (ca && cb) return ca === cb;
	if (ca && normalizeName(ca) === nb) return true;
	if (cb && normalizeName(cb) === na) return true;
	return false;
}
//#endregion
export { canonicalTechName as n, sameTech as r, DEFAULT_TECHS as t };
