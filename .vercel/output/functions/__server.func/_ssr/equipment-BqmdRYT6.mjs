//#region node_modules/.nitro/vite/services/ssr/assets/equipment-BqmdRYT6.js
var ALIASES = [
	{
		test: /c['’]?2m|\bc2m\b|cameo.{0,12}2m/i,
		model: "Eversys Cameo c'2m"
	},
	{
		test: /c['’]?2s|\bc2s\b|cameo.{0,16}2\s*step/i,
		model: "Eversys Cameo c'2s"
	},
	{
		test: /cameo/i,
		model: "Eversys Cameo c'2s"
	},
	{
		test: /e['’]?4m|\be4m\b/i,
		model: "Eversys e'4m"
	},
	{
		test: /e['’]?4s?|\be4\b|enigma/i,
		model: "Eversys e'4s"
	},
	{
		test: /\bitcb\b/i,
		model: "Bunn ITCB"
	},
	{
		test: /\btb3\b/i,
		model: "Bunn TB3"
	},
	{
		test: /axiom/i,
		model: "Bunn Axiom-APS"
	},
	{
		test: /cwtf/i,
		model: "Bunn CWTF-APS"
	},
	{
		test: /\bicb\b/i,
		model: "Bunn ICB Tall"
	},
	{
		test: /\bitb\b/i,
		model: "Bunn ITB-DD"
	},
	{
		test: /2051/i,
		model: "Fetco 2051e"
	},
	{
		test: /\b52h\b/i,
		model: "Fetco 52H"
	},
	{
		test: /sego/i,
		model: "Bravilor Sego 12"
	},
	{
		test: /classe\s*9/i,
		model: "Rancilio Classe 9"
	},
	{
		test: /classe\s*5/i,
		model: "Rancilio Classe 5 Compact"
	},
	{
		test: /strada/i,
		model: "La Marzocco Strada XT"
	},
	{
		test: /linea/i,
		model: "La Marzocco Linea S"
	},
	{
		test: /legacy/i,
		model: "Eversys Legacy"
	},
	{
		test: /\bg9[- ]?2t\b/i,
		model: "Bunn G9-2T"
	},
	{
		test: /\bg9\b/i,
		model: "Bunn G9"
	}
];
function normalize(s) {
	return s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function samePiece(a, b) {
	const na = normalize(a);
	const nb = normalize(b);
	return !!na && !!nb && na === nb;
}
function cleanPiece(raw) {
	let t = raw.replace(/\s+/g, " ").trim();
	t = t.replace(/^\(+/, "").replace(/\)+$/, "").trim();
	t = t.replace(/^(qty\s*)?\d+\s*[x×]\s*/i, "");
	t = t.replace(/\s*[x×]\s*\d+\s*$/i, "");
	t = t.replace(/\bwith\s+[\d.]+\s*wands?\b/i, "");
	t = t.replace(/\b\d+\s*v(olts?)?\b/i, "");
	t = t.replace(/\s+/g, " ").trim();
	if (!t || t.length < 2) return null;
	if (/^\d+$/.test(t)) return null;
	if (/^(need a |not here|new in barn|from cafeteria|for the time|po\b|loaner|sn\b)/i.test(t)) return null;
	return t;
}
/** Split a messy install equipment blob into one piece per machine. */
function splitEquipment(raw) {
	if (!raw?.trim()) return [];
	const pieces = [];
	for (const line of raw.split(/\r?\n/)) {
		const stripped = line.replace(/\bSN\s*:?\s*[A-Z0-9\-]+/gi, " ");
		for (const part of stripped.split(/\s*(?:&|\/|,|\band\b|\+)\s*/i)) {
			const cleaned = cleanPiece(part);
			if (!cleaned) continue;
			pieces.push(cleaned);
		}
	}
	return pieces;
}
/** Reassemble equipment chips for storage. Empty list → null (never invented). */
function joinEquipment(pieces) {
	const next = pieces.map((p) => p.trim()).filter(Boolean);
	return next.length ? next.join("\n") : null;
}
/**
* Read equipment as listed on an install. Newline-separated catalog names
* stay intact (commas in model names are not split). Two of the same model
* stay two machines. Single-line legacy blobs still split on & / , and +.
*/
function listedEquipment(raw, catalog = []) {
	if (!raw?.trim()) return [];
	const catalogKey = new Map(catalog.map((c) => [normalize(c), c]));
	const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
	const out = [];
	const push = (name) => {
		const mapped = catalogKey.get(normalize(name)) ?? name;
		if (mapped.trim()) out.push(mapped);
	};
	if (lines.length > 1) {
		for (const line of lines) push(line);
		return out;
	}
	const only = lines[0];
	if (catalogKey.has(normalize(only))) {
		push(only);
		return out;
	}
	if (catalog.length) {
		const nOnly = normalize(only);
		const contained = catalog.filter((c) => {
			const n = normalize(c);
			return n && (nOnly === n || nOnly.includes(n) || n.includes(nOnly));
		}).sort((a, b) => normalize(b).length - normalize(a).length);
		if (contained[0] && (nOnly === normalize(contained[0]) || nOnly.includes(normalize(contained[0])))) {
			push(contained[0]);
			if (!nOnly.replace(normalize(contained[0]), " ").trim()) return out;
		}
	}
	for (const piece of splitEquipment(only)) push(piece);
	return out;
}
function matchModel(piece, catalog) {
	for (const a of ALIASES) if (a.test.test(piece)) return a.model;
	const n = normalize(piece);
	if (!n) return piece;
	let best = null;
	for (const model of catalog) {
		const m = normalize(model);
		if (!m) continue;
		if (m === n) return model;
		if (n.includes(m) || m.includes(n)) {
			const score = Math.min(m.length, n.length);
			if (!best || score > best.score) best = {
				model,
				score
			};
		}
	}
	return best?.model ?? piece;
}
function parseInstallEquipment(raw, catalog = []) {
	return listedEquipment(raw, catalog).map((label) => ({
		label,
		model: matchModel(label, catalog)
	}));
}
/** Drop one machine from an install. Empty list becomes null. */
function dropEquipment(raw, label, catalog = []) {
	const pieces = listedEquipment(raw, catalog);
	const model = matchModel(label, catalog);
	const idx = pieces.findIndex((p) => samePiece(p, label) || samePiece(p, model) || samePiece(matchModel(p, catalog), label) || samePiece(matchModel(p, catalog), model));
	if (idx >= 0) {
		const next = pieces.slice();
		next.splice(idx, 1);
		return joinEquipment(next);
	}
	const n = normalize(label);
	const fallbackIdx = pieces.findIndex((p) => {
		const pn = normalize(p);
		return pn === n || pn.includes(n) || n.includes(pn);
	});
	if (fallbackIdx >= 0) {
		const next = pieces.slice();
		next.splice(fallbackIdx, 1);
		return joinEquipment(next);
	}
	return joinEquipment(pieces.filter((p) => p !== label));
}
function catalogModels(models) {
	const set = /* @__PURE__ */ new Set();
	for (const m of models) {
		const t = m.trim();
		if (t) set.add(t);
	}
	return [...set].sort((a, b) => a.localeCompare(b));
}
function findRecipeFor(recipes, opts) {
	const modelKey = opts.model.toLowerCase();
	const custKey = opts.customer.trim().toLowerCase();
	const house = recipes.find((r) => !r.customer && r.equipmentModel.toLowerCase() === modelKey) ?? null;
	return {
		linked: (opts.installId ? recipes.find((r) => r.installId === opts.installId && r.equipmentModel.toLowerCase() === modelKey) : void 0) ?? recipes.find((r) => !!r.customer && r.customer.toLowerCase() === custKey && r.equipmentModel.toLowerCase() === modelKey) ?? null,
		house
	};
}
function piecesForInstall(equipment, _customer, _installId, catalog, _recipes) {
	return parseInstallEquipment(equipment, catalog);
}
function shortEquipLabel(label, max = 22) {
	const t = label.trim();
	if (t.length <= max) return t;
	return `${t.slice(0, max - 1)}…`;
}
//#endregion
export { listedEquipment as a, joinEquipment as i, dropEquipment as n, piecesForInstall as o, findRecipeFor as r, shortEquipLabel as s, catalogModels as t };
