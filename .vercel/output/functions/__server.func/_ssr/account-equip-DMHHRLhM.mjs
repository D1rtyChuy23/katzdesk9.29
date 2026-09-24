import { r as __exportAll } from "../_runtime.mjs";
import { c as __exportAll$1 } from "./ssr.mjs";
import { n as normalizeCustomerKey, t as isWalkIn } from "./customer-key-BKZJDViL.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/account-equip-DMHHRLhM.js
var account_equip_DMHHRLhM_exports = /* @__PURE__ */ __exportAll({
	a: () => matchCatalogModel,
	c: () => parseSerial,
	i: () => matchAccount,
	l: () => sameCatalogModel,
	n: () => account_equip_exports,
	o: () => matchExistingUnit,
	r: () => mapOwnership,
	s: () => parseInstallDate,
	t: () => OWNERSHIP_VALUES,
	u: () => serialKey
});
var account_equip_exports = /* @__PURE__ */ __exportAll$1({
	OWNERSHIP_VALUES: () => OWNERSHIP_VALUES,
	compactEquip: () => compactEquip,
	mapOwnership: () => mapOwnership,
	matchAccount: () => matchAccount,
	matchCatalogModel: () => matchCatalogModel,
	matchExistingUnit: () => matchExistingUnit,
	parseInstallDate: () => parseInstallDate,
	parseSerial: () => parseSerial,
	sameCatalogModel: () => sameCatalogModel,
	sameEquipLabel: () => sameEquipLabel,
	serialKey: () => serialKey,
	stripEquipNoise: () => stripEquipNoise
});
var OWNERSHIP_VALUES = [
	"Loaned",
	"Owned - Purchased from Katz",
	"Owned - Purchased from 3rd Party",
	"Owned",
	"Lease"
];
var GENERIC_TOKENS = /* @__PURE__ */ new Set([
	"bunn",
	"fetco",
	"eversys",
	"rancilio",
	"mazzer",
	"bravilor",
	"wilbur",
	"curtis",
	"ditting",
	"everpure",
	"puqpress",
	"faema",
	"blendtec",
	"mahlkonig",
	"vitrifrigo",
	"modbar",
	"la",
	"marzocco",
	"brewer",
	"combo",
	"grinder",
	"series",
	"dual",
	"portion",
	"coffee",
	"tea",
	"machine",
	"espresso",
	"automatic",
	"electronic",
	"with",
	"shelf",
	"kitchen",
	"front",
	"back",
	"upstairs",
	"downstairs",
	"banquet",
	"restaurant",
	"pour",
	"over",
	"from",
	"the",
	"of",
	"and",
	"w",
	"blk",
	"black",
	"chrome",
	"hot",
	"water",
	"tower",
	"retail",
	"aps",
	"ns",
	"dept",
	"parts",
	"service",
	"showroom",
	"body",
	"shop",
	"used",
	"cars",
	"classic",
	"step",
	"group",
	"av",
	"usb",
	"semi",
	"volumetric",
	"tall",
	"compact",
	"auto",
	"on",
	"demand",
	"french",
	"press",
	"hopper",
	"batch",
	"buttons",
	"element",
	"immersion",
	"dilute",
	"carafe",
	"thermal",
	"specialty",
	"dispenser",
	"filtration",
	"system",
	"reverse",
	"osmosis",
	"owned",
	"purchased",
	"katz",
	"loaned",
	"lease",
	"configuration",
	"electrical",
	"single",
	"twin",
	"lower",
	"upper",
	"warmers",
	"warmer",
	"plus",
	"pro",
	"wide",
	"super",
	"traditional",
	"beside",
	"fridge",
	"enigma",
	"shotmaster"
]);
var EMPTY_SERIAL = /^(n\/?a|na|n a|not available|not avail|none|null|unknown|-|—|–)$/i;
function serialKey(raw) {
	return (raw ?? "").trim().replace(/[#\s]/g, "").toLowerCase();
}
function compactEquip(raw) {
	return String(raw ?? "").toLowerCase().replace(/['’]/g, "").replace(/\([^)]*\)/g, " ").replace(/#\s*\d+\b/g, " ").replace(/(\d)[.\-](?=\d)/g, "$1").replace(/([a-z])[.\-](?=\d)/g, "$1").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function stripEquipNoise(raw) {
	return String(raw ?? "").replace(/\([^)]*\)/g, " ").replace(/#\s*\d+\b/g, " ").replace(/\s+/g, " ").trim();
}
function escapeRe(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function hasWord(haystack, token) {
	if (!token) return false;
	return new RegExp(`(?:^| )${escapeRe(token)}(?:$| )`).test(` ${haystack} `);
}
function tokensOf(raw) {
	return compactEquip(raw).split(" ").filter(Boolean);
}
function distinctiveTokens(raw) {
	return tokensOf(raw).filter((t) => t.length >= 2 && !GENERIC_TOKENS.has(t));
}
function uniqueByDistinctive(query, catalog) {
	const tokens = distinctiveTokens(query);
	if (!tokens.length) return [];
	return catalog.filter((c) => tokens.every((t) => hasWord(compactEquip(c), t)));
}
function uniqueByPrefix(query, catalog) {
	const q = compactEquip(query);
	if (q.length < 8) return [];
	return catalog.filter((c) => {
		const n = compactEquip(c);
		return n === q || n.startsWith(`${q} `);
	});
}
function fitsDistinctive(catalogName, query) {
	const tokens = distinctiveTokens(query);
	if (!tokens.length) return true;
	return tokens.every((t) => hasWord(compactEquip(catalogName), t));
}
function catalogScore(piece, model) {
	const n = compactEquip(piece);
	const m = compactEquip(model);
	if (!n || !m) return 0;
	if (n === m) return 1e4 + m.length;
	const pt = n.split(" ").filter(Boolean);
	const mt = m.split(" ").filter(Boolean);
	if (!pt.length) return 0;
	if (m.startsWith(n) || n.length >= 6 && n.startsWith(m)) return 5e3 + Math.min(n.length, m.length);
	if (n.length >= 6 && (m.includes(n) || n.includes(m))) return 3e3 + Math.min(n.length, m.length) - Math.abs(m.length - n.length) / 100;
	let hits = 0;
	for (const t of pt) {
		if (!mt.some((x) => x === t || t.length >= 3 && x.includes(t) || x.length >= 3 && t.includes(x))) return 0;
		hits += 1;
	}
	const extra = Math.max(0, mt.length - pt.length);
	return 2e3 + hits * 20 - extra;
}
function uniqueByScore(query, catalog) {
	const q = stripEquipNoise(query);
	if (!q) return [];
	const scored = catalog.map((c) => ({
		c,
		score: catalogScore(q, c)
	})).filter((x) => x.score >= 2e3).sort((a, b) => b.score - a.score || b.c.length - a.c.length);
	if (!scored.length) return [];
	const best = scored[0].score;
	return scored.filter((x) => x.score >= best - 50).map((x) => x.c);
}
function catalogHas(name, catalog) {
	const key = compactEquip(name);
	if (!key) return null;
	return catalog.find((c) => compactEquip(c) === key) ?? null;
}
function sameCatalogModel(a, b) {
	return compactEquip(a) === compactEquip(b) && !!compactEquip(a);
}
function matchAccount(name, accounts) {
	const trimmed = String(name ?? "").trim();
	if (!trimmed) return {
		status: "unmatched",
		account: null,
		candidates: []
	};
	if (isWalkIn(trimmed)) return {
		status: "walk-in",
		account: null,
		candidates: []
	};
	const key = normalizeCustomerKey(trimmed);
	if (!key) return {
		status: "unmatched",
		account: null,
		candidates: []
	};
	const hits = accounts.filter((a) => normalizeCustomerKey(a.name) === key);
	if (hits.length === 1) return {
		status: "matched",
		account: hits[0],
		candidates: hits
	};
	if (hits.length > 1) return {
		status: "ambiguous",
		account: null,
		candidates: hits
	};
	return {
		status: "unmatched",
		account: null,
		candidates: []
	};
}
function matchCatalogModel(equipmentName, model, catalog) {
	const m = stripEquipNoise(model);
	const e = stripEquipNoise(equipmentName);
	if (m) {
		const exact = catalogHas(m, catalog) ?? catalogHas(model, catalog);
		if (exact && fitsDistinctive(exact, e)) return {
			status: "matched",
			catalogModel: exact,
			candidates: [exact],
			reason: "exact-model"
		};
	}
	if (e) {
		const exact = catalogHas(e, catalog) ?? catalogHas(equipmentName, catalog);
		if (exact && fitsDistinctive(exact, m)) return {
			status: "matched",
			catalogModel: exact,
			candidates: [exact],
			reason: "exact-name"
		};
	}
	const distM = m ? uniqueByDistinctive(m, catalog) : [];
	const distE = e ? uniqueByDistinctive(e, catalog) : [];
	const combined = [e, m].filter(Boolean).join(" ");
	const distC = combined ? uniqueByDistinctive(combined, catalog) : [];
	if (distM.length && distE.length) {
		const inter = distM.filter((x) => distE.includes(x));
		if (inter.length === 1) return {
			status: "matched",
			catalogModel: inter[0],
			candidates: inter,
			reason: "distinctive-agree"
		};
		if (inter.length === 0) return {
			status: "ambiguous",
			catalogModel: null,
			candidates: uniqueNames([...distE, ...distM]).slice(0, 8),
			reason: "name-model-disagree"
		};
	}
	if (distM.length === 1) return {
		status: "matched",
		catalogModel: distM[0],
		candidates: distM,
		reason: "distinctive-model"
	};
	if (distE.length === 1) return {
		status: "matched",
		catalogModel: distE[0],
		candidates: distE,
		reason: "distinctive-name"
	};
	if (distC.length === 1) return {
		status: "matched",
		catalogModel: distC[0],
		candidates: distC,
		reason: "distinctive-combined"
	};
	const prefixM = m ? uniqueByPrefix(m, catalog).filter((c) => fitsDistinctive(c, e)) : [];
	if (prefixM.length === 1) return {
		status: "matched",
		catalogModel: prefixM[0],
		candidates: prefixM,
		reason: "prefix-model"
	};
	const prefixE = e ? uniqueByPrefix(e, catalog).filter((c) => fitsDistinctive(c, m)) : [];
	if (prefixE.length === 1) return {
		status: "matched",
		catalogModel: prefixE[0],
		candidates: prefixE,
		reason: "prefix-name"
	};
	const scoreM = m ? uniqueByScore(m, catalog).filter((c) => fitsDistinctive(c, e)) : [];
	const scoreE = e ? uniqueByScore(e, catalog).filter((c) => fitsDistinctive(c, m)) : [];
	const scoreC = combined ? uniqueByScore(combined, catalog) : [];
	if (scoreM.length === 1) return {
		status: "matched",
		catalogModel: scoreM[0],
		candidates: scoreM,
		reason: "score-model"
	};
	if (scoreE.length === 1) return {
		status: "matched",
		catalogModel: scoreE[0],
		candidates: scoreE,
		reason: "score-name"
	};
	if (scoreC.length === 1) return {
		status: "matched",
		catalogModel: scoreC[0],
		candidates: scoreC,
		reason: "score-combined"
	};
	const candidates = uniqueNames([
		...prefixM,
		...prefixE,
		...distM,
		...distE,
		...distC,
		...scoreM,
		...scoreE,
		...scoreC
	]);
	return {
		status: candidates.length ? "ambiguous" : "unmatched",
		catalogModel: null,
		candidates: candidates.slice(0, 8),
		reason: candidates.length ? "ambiguous" : "unmatched"
	};
}
function uniqueNames(names) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const n of names) {
		const k = compactEquip(n);
		if (!k || seen.has(k)) continue;
		seen.add(k);
		out.push(n);
	}
	return out;
}
function parseSerial(raw) {
	const s = String(raw ?? "").replace(/[\u00a0\u202f\u2007\u2009]/g, " ").replace(/\s+/g, " ").trim();
	if (!s) return null;
	if (EMPTY_SERIAL.test(s)) return null;
	return s;
}
function parseInstallDate(raw) {
	const s = String(raw ?? "").trim();
	if (!s || EMPTY_SERIAL.test(s)) return null;
	const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
	if (iso) return iso[1];
	const us = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
	if (us) {
		const month = Number(us[1]);
		const day = Number(us[2]);
		let year = Number(us[3]);
		if (year < 100) year += year >= 70 ? 1900 : 2e3;
		if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1990 && year <= 2100) return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
	}
	const n = Number(s);
	if (Number.isFinite(n) && n > 2e4 && n < 9e4) {
		const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 864e5);
		if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
	}
	const t = Date.parse(s);
	if (!Number.isFinite(t)) return null;
	const d = new Date(t);
	if (Number.isNaN(d.getTime())) return null;
	return d.toISOString().slice(0, 10);
}
function mapOwnership(raw) {
	const original = String(raw ?? "").trim();
	const n = original.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
	if (!n) return {
		value: null,
		status: "blank",
		raw: original
	};
	if (n === "loaned" || n === "loan" || n === "on loan") return {
		value: "Loaned",
		status: "mapped",
		raw: original
	};
	if (/\bkatz\b/.test(n) && /\b(owned|purchased|bought)\b/.test(n)) return {
		value: "Owned - Purchased from Katz",
		status: "mapped",
		raw: original
	};
	if (/\b(3rd|third)\b/.test(n) && /\b(owned|purchased|bought|party)\b/.test(n)) return {
		value: "Owned - Purchased from 3rd Party",
		status: "mapped",
		raw: original
	};
	if (n === "owned" || n === "owner") return {
		value: "Owned",
		status: "mapped",
		raw: original
	};
	if (n === "lease" || n === "leased" || n === "on lease") return {
		value: "Lease",
		status: "mapped",
		raw: original
	};
	for (const o of OWNERSHIP_VALUES) if (o.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim() === n) return {
		value: o,
		status: "mapped",
		raw: original
	};
	return {
		value: null,
		status: "unknown",
		raw: original
	};
}
function sameEquipLabel(a, b) {
	return compactEquip(a) === compactEquip(b) && !!compactEquip(a);
}
function matchExistingUnit(opts) {
	const customerKey = normalizeCustomerKey(opts.customer);
	const key = serialKey(opts.serial);
	if (key) {
		const foreign = opts.existing.find((e) => serialKey(e.serial) === key && normalizeCustomerKey(e.customer) !== customerKey);
		if (foreign) return {
			action: "review",
			existingId: null,
			foreignAccount: foreign.customer
		};
		const same = opts.existing.find((e) => serialKey(e.serial) === key && normalizeCustomerKey(e.customer) === customerKey && sameCatalogModel(e.catalogModel, opts.catalogModel));
		if (same) return {
			action: "update",
			existingId: same.id,
			foreignAccount: null
		};
		return {
			action: "add",
			existingId: null,
			foreignAccount: null
		};
	}
	const same = opts.existing.find((e) => normalizeCustomerKey(e.customer) === customerKey && sameCatalogModel(e.catalogModel, opts.catalogModel) && sameEquipLabel(e.equipmentName, opts.equipmentName) && !serialKey(e.serial));
	if (same) return {
		action: "update",
		existingId: same.id,
		foreignAccount: null
	};
	return {
		action: "add",
		existingId: null,
		foreignAccount: null
	};
}
//#endregion
export { matchCatalogModel as a, parseSerial as c, matchAccount as i, sameCatalogModel as l, account_equip_DMHHRLhM_exports as n, matchExistingUnit as o, mapOwnership as r, parseInstallDate as s, OWNERSHIP_VALUES as t, serialKey as u };
