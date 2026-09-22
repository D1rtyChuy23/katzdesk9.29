//#region src/lib/ops/equipment.ts
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
function escapeRe(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function catalogPattern(name) {
	const parts = name.trim().split(/[^a-zA-Z0-9]+/).filter((p) => p.length > 0).map(escapeRe);
	if (!parts.length) return null;
	return new RegExp(`(?<![a-zA-Z0-9])${parts.join("[^a-zA-Z0-9]+")}(?![a-zA-Z0-9])`, "i");
}
function nextCatalogHit(text, patterns) {
	let best = null;
	for (const { name, re } of patterns) {
		re.lastIndex = 0;
		const m = re.exec(text);
		if (!m || m.index < 0) continue;
		const end = m.index + m[0].length;
		if (!best || m.index < best.index || m.index === best.index && end - m.index > best.end - best.index) best = {
			index: m.index,
			end,
			name
		};
	}
	return best;
}
/** Between-machine separators. Never split GB/5, A/2, 1L/2U. */
var BETWEEN_MACHINES = /\s+(?:&|\+|and)\s+|,\s+|(?<=[A-Za-z]{2,})\s*\/\s*(?=[A-Z][a-zA-Z])/i;
function splitNonCatalog(raw, catalog) {
	const pieces = [];
	for (const part of raw.split(BETWEEN_MACHINES)) {
		const cleaned = cleanPiece(part);
		if (cleaned) pieces.push(matchModel(cleaned, catalog));
	}
	return pieces;
}
function extractLine(line, catalog, catalogKey, patterns) {
	const exact = catalogKey.get(normalize(line));
	if (exact) return [exact];
	if (!patterns.length) return splitNonCatalog(line, catalog);
	const out = [];
	let rest = line;
	let guard = 0;
	while (rest.trim() && guard++ < 40) {
		const hit = nextCatalogHit(rest, patterns);
		if (!hit) {
			out.push(...splitNonCatalog(rest, catalog));
			break;
		}
		const before = rest.slice(0, hit.index).trim();
		if (before) out.push(...splitNonCatalog(before, catalog));
		out.push(hit.name);
		rest = rest.slice(hit.end).replace(/^[\s,;+&]+|^\s*\/\s*|^\s+and\s+/i, "");
	}
	return out.filter(Boolean);
}
/**
* Read equipment as listed. Catalog names stay one chip even when they contain
* commas or slashes ("Bunn Axiom-15-3, 1L/2U", "La Marzocco GB/5 S 3 Group AV").
* Messy one-line blobs still split between machines on " & " / " and " / "," / ".
*/
function listedEquipment(raw, catalog = []) {
	if (!raw?.trim()) return [];
	const catalogKey = new Map(catalog.map((c) => [normalize(c), c]));
	const patterns = catalog.map((name) => {
		const re = catalogPattern(name);
		return re ? {
			name,
			re
		} : null;
	}).filter((x) => !!x).sort((a, b) => b.name.length - a.name.length);
	const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
	const out = [];
	for (const line of lines) {
		const pieces = extractLine(line.replace(/\bSN\s*:?\s*[A-Z0-9\-]+/gi, " ").replace(/\s+/g, " ").trim() || line, catalog, catalogKey, patterns);
		if (pieces.length) out.push(...pieces);
		else out.push(matchModel(line, catalog));
	}
	return rejoinSplitModels(out, catalogKey);
}
/** Reassemble equipment chips for storage. Empty list → null (never invented). */
function joinEquipment(pieces) {
	const next = pieces.map((p) => p.trim()).filter(Boolean);
	return next.length ? next.join("\n") : null;
}
/** Repair names that were split on a model slash (GB/5, A/2, 1L/2U). */
function rejoinSplitModels(pieces, catalogKey) {
	if (pieces.length < 2) return pieces;
	const out = [];
	for (let i = 0; i < pieces.length; i++) {
		const a = pieces[i];
		const b = pieces[i + 1];
		if (b) {
			const slash = catalogKey.get(normalize(`${a}/${b}`));
			const spaced = catalogKey.get(normalize(`${a} ${b}`));
			if (slash || spaced) {
				out.push(slash ?? spaced);
				i += 1;
				continue;
			}
			if (/^\d/.test(b.trim()) && !/\b(group|grinder|hopper)\b/i.test(a)) {
				out.push(`${a}/${b}`);
				i += 1;
				continue;
			}
		}
		out.push(a);
	}
	return out;
}
function tokens(s) {
	return normalize(s).split(/\s+/).filter(Boolean);
}
/** Score a typed/spreadsheet fragment against an uploaded catalog name. Higher is better. */
function catalogScore(piece, model) {
	const n = normalize(piece);
	const m = normalize(model);
	if (!n || !m) return 0;
	if (n === m) return 1e4 + m.length;
	const pt = tokens(piece);
	const mt = tokens(model);
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
function matchModel(piece, catalog) {
	const raw = piece.trim();
	if (!raw) return piece;
	const key = normalize(raw);
	const exact = catalog.find((c) => normalize(c) === key);
	if (exact) return exact;
	const aliasName = aliasCanonical(raw);
	const looksLikeBlob = raw.length > 40 || /\/.+\//.test(raw) || raw.includes("/") && raw.includes(",");
	if (aliasName && !looksLikeBlob) {
		const aliasExact = catalog.find((c) => normalize(c) === normalize(aliasName));
		if (aliasExact) return aliasExact;
		const unique = catalog.filter((c) => catalogScore(aliasName, c) >= 1e4);
		if (unique.length === 1) return unique[0];
		return aliasName;
	}
	if (!catalog.length) return raw;
	let best = null;
	for (const model of catalog) {
		const score = catalogScore(raw, model);
		if (score <= 0) continue;
		if (!best || score > best.score || score === best.score && model.length > best.model.length) best = {
			model,
			score
		};
	}
	const pt = tokens(raw);
	const nearBest = best && catalog.filter((c) => catalogScore(raw, c) >= (best?.score ?? 0) - 2).length === 1;
	if (Boolean(best && best.score >= 5e3 && (pt.length > 1 || nearBest)) && best) return best.model;
	return best && best.score >= 1e4 ? best.model : raw;
}
function aliasCanonical(raw) {
	const n = normalize(raw);
	if (n.split(/\s+/).filter(Boolean).length >= 5) return null;
	if (/\bgroup\b/.test(n)) return null;
	for (const a of ALIASES) if (a.test.test(raw)) return a.model;
	return null;
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
/** Swap one listed model for another inside a stored equipment blob. */
function rewriteEquipmentName(raw, from, to, catalog = []) {
	if (raw == null) return null;
	if (!raw.trim()) return raw;
	const src = from.trim();
	const dest = to.trim();
	if (!src || !dest) return raw;
	if (samePiece(raw, src)) return dest;
	const pieces = listedEquipment(raw, catalogModels([
		...catalog,
		src,
		dest
	]));
	let hit = false;
	const next = pieces.map((p) => {
		if (samePiece(p, src)) {
			hit = true;
			return dest;
		}
		return p;
	});
	if (hit) return joinEquipment(next);
	const lines = raw.split(/\r?\n/);
	let lineHit = false;
	const mapped = lines.map((line) => {
		const stripped = line.replace(/\bSN\s*:?\s*[A-Z0-9\-]+/gi, " ").replace(/\s+/g, " ").trim();
		if (samePiece(line, src) || samePiece(stripped, src)) {
			lineHit = true;
			return dest;
		}
		return line;
	});
	return lineHit ? mapped.join("\n") : raw;
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
//#region src/lib/ops/machines.ts
function parseMachinesJson(raw) {
	if (!raw?.trim()) return [];
	try {
		const v = JSON.parse(raw);
		if (!Array.isArray(v)) return [];
		const out = [];
		for (const row of v) {
			if (!row || typeof row !== "object") continue;
			const rec = row;
			const equipment = String(rec.equipment ?? "").trim();
			if (!equipment) continue;
			out.push({
				equipment,
				serial: String(rec.serial ?? "").trim(),
				powerVoltage: String(rec.powerVoltage ?? "").trim()
			});
		}
		return out;
	} catch {
		return [];
	}
}
function takeSpec(pool, equipment) {
	const key = equipment.toLowerCase();
	const idx = pool.findIndex((s) => s.equipment.toLowerCase() === key);
	if (idx < 0) return void 0;
	return pool.splice(idx, 1)[0];
}
function mergeMachineSpecs(names, previous = [], legacy) {
	const fromJson = parseMachinesJson(legacy?.machines);
	const prev = [...previous];
	const json = [...fromJson];
	const specs = names.map((equipment) => {
		const hit = takeSpec(prev, equipment) ?? takeSpec(json, equipment);
		return {
			equipment,
			serial: hit?.serial ?? "",
			powerVoltage: hit?.powerVoltage ?? ""
		};
	});
	if (!(fromJson.length > 0) && specs.length === 1) {
		const only = specs[0];
		if (!only.serial && legacy?.serial && !legacy.serial.trim().startsWith("[")) only.serial = legacy.serial.trim();
		if (!only.powerVoltage && legacy?.powerVoltage && !legacy.powerVoltage.trim().startsWith("[")) only.powerVoltage = legacy.powerVoltage.trim();
	}
	return specs;
}
function serializeMachines(specs) {
	const clean = specs.map((s) => ({
		equipment: s.equipment.trim(),
		serial: s.serial.trim(),
		powerVoltage: s.powerVoltage.trim()
	})).filter((s) => s.equipment);
	if (!clean.length) return {
		equipment: null,
		machines: null,
		serial: null,
		powerVoltage: null
	};
	const serials = clean.map((s) => s.serial).filter(Boolean);
	const powers = clean.map((s) => s.powerVoltage).filter(Boolean);
	return {
		equipment: joinEquipment(clean.map((s) => s.equipment)),
		machines: JSON.stringify(clean),
		serial: serials.length ? serials.join(" · ") : null,
		powerVoltage: powers.length ? powers.join(" · ") : null
	};
}
function specsFromInstall(equipment, serial, powerVoltage, machines, catalog = []) {
	const fromJson = parseMachinesJson(machines);
	if (fromJson.length) return mergeMachineSpecs(listedEquipment(fromJson.map((s) => s.equipment).join("\n"), catalog), fromJson, {
		serial,
		powerVoltage
	});
	return mergeMachineSpecs(listedEquipment(equipment, catalog), [], {
		serial,
		powerVoltage
	});
}
//#endregion
export { catalogModels as a, listedEquipment as c, rewriteEquipmentName as d, samePiece as f, specsFromInstall as i, matchModel as l, parseMachinesJson as n, dropEquipment as o, shortEquipLabel as p, serializeMachines as r, findRecipeFor as s, mergeMachineSpecs as t, piecesForInstall as u };
