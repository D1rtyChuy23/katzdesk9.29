import { _n as preprocess, hn as object, ln as array, sn as _enum, yn as string } from "../_libs/@better-auth/core+[...].mjs";
import { n as isEversysMachine } from "./eversys-Bk1Dg0we.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/spec-schema-Ba1ui6_6.js
var US_MARKS = /\b(c?UL|cULus|ETL|c?ETLus|NSF|CSA|ENERGY\s*STAR|Intertek|FCC|NEMA)\b/i;
var NON_US_MARKS = /\b(CE|UKCA|RoHS|WEEE|EAC|CCC|KC|VDE|GS|TÜV|TUV|SAA|RCM|PSE|DVGW|WRAS|KIWA|ÖVGW|SVGW|ACS)\b/i;
var NON_US_MARK_TOKENS = /^(CE|UKCA|RoHS(\s*\d+)?|WEEE|EAC|CCC|KC|VDE|GS|TÜV|TUV|SAA|RCM|PSE|DVGW|WRAS|KIWA|ÖVGW|SVGW|ACS|EN\s?\d[\d\-:. ]*|IEC\s?\d[\d\-:. ]*|2014\/\d+\/EU|20\d\d\/\d+\/EU)( marking| mark| compliant| certified)?$/i;
/** 220–240 V class and European 3-phase (380–415 V, 400 V 3N). 208–240 V and 240 V stay (US). */
var EURO_VOLT = /\b(2[23]0|380|400|415)\s*(?:[-–/]\s*(?:2[34]0|415|400))?\s*V(?:AC|olts?)?\b|\b3\s*N\s*~?\s*400\b/i;
/** A US supply voltage that starts the expression (so the "240" inside "220-240V" doesn't count). */
var US_VOLT = /(?<![\d\-–/]\s?)\b(100|110|115|120|125|200|208|240|277|440|460|480)\s*(?:[-–/]\s*\d{3})?\s*V/i;
var FIFTY_ONLY = /\b50\s*Hz\b/i;
var SIXTY = /\b60\s*Hz\b/i;
var FIFTY_SIXTY = /\b50\s*[/-]\s*60\s*Hz\b/i;
var NON_US_PLUG = /\b(schuko|cee\s*7\/?\d*|bs\s*1363|bs\s*546|type\s*[cefgijklm]\b|iec\s*60309|cee\s*form|uk\s*plug|eu(ro)?\s*plug|european\s*plug|as\/nzs\s*3112|si\s*32|gb\s*1002|sev\s*1011|cei\s*23-50|16\s*a\s*cee|32\s*a\s*cee)/i;
var US_PLUG = /\b(nema|l\d+-\d+|\d+-\d+[pr]\b|hardwire|hard-?wired|direct\s*wire|cord\s*and\s*plug)/i;
/** Non-US water standards and fittings — removed even when an inch size is quoted (BSP is not NPT). */
var METRIC_WATER = /(\bbsp[pt]?\b|\bg\s?[1-9]\/[1-9]\b|\bg\s?[1-9]"|\bdin\s?\d+|\ben\s?\d{3,5}\b|\bwras\b|\bkiwa\b|\bdvgw\b|\bacs\b|°\s?[df]h\b)/i;
/** Metric units — only removed when no imperial value sits next to them. */
var METRIC_ONLY_UNIT = /\d(?:[.,]\d+)?\s*(bar|mm|cm|kpa|mpa|l\/min|l\/h|litres?|liters?)\b/i;
var IMPERIAL = /(psi|"|”|\binch|\bin\.?\b|\bnpt\b|\bgpm\b|\bgph\b|\bgal|\bft\b|\blb|\bfl\.?\s?oz)/i;
var NON_US_PHONE = /\+\s?(?!1\b|1[\s\-(])\d{1,3}[\s\-(]/;
var US_PHONE = /(\+\s?1[\s\-(]|\(\d{3}\)\s?\d{3}|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b|\b1-8\d{2}-)/;
var NON_US_PLACE = /\b(italy|italia|germany|deutschland|united kingdom|\buk\b|england|switzerland|schweiz|suisse|france|netherlands|nederland|spain|españa|sweden|denmark|norway|austria|belgium|portugal|australia|new zealand|china|japan|korea|\.it\b|\.de\b|\.co\.uk\b|\.ch\b|\.fr\b|\.nl\b|\.com\.au\b)/i;
var US_STATE_ZIP = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY),?\s\d{5}(-\d{4})?\b/;
function splitParts(v) {
	return v.split(/\s*(?:;|,|\bor\b|\s\/\s|(?<=\d\s?V)\s*\/\s*(?=\d)|\|)\s*/i).map((p) => p.trim()).filter(Boolean);
}
/** Frequency: "50 Hz" goes; "50/60 Hz" becomes "60 Hz". */
function filterHz(v) {
	if (FIFTY_SIXTY.test(v)) return {
		kept: v.replace(FIFTY_SIXTY, "60 Hz"),
		removed: ["50 Hz"]
	};
	if (FIFTY_ONLY.test(v) && !SIXTY.test(v)) {
		const parts = splitParts(v);
		const removed = parts.filter((p) => FIFTY_ONLY.test(p));
		return {
			kept: parts.filter((p) => !FIFTY_ONLY.test(p)).join(", "),
			removed: removed.length ? removed : [v]
		};
	}
	if (FIFTY_ONLY.test(v) && SIXTY.test(v)) {
		const parts = splitParts(v);
		const removed = parts.filter((p) => FIFTY_ONLY.test(p) && !SIXTY.test(p));
		if (removed.length) return {
			kept: parts.filter((p) => !removed.includes(p)).join(", "),
			removed
		};
	}
	return {
		kept: v,
		removed: []
	};
}
/** An electrical line like "230V 50Hz 1ph" or "120V/60Hz, 230V/50Hz". */
function filterElectrical(v) {
	const parts = v.split(/\s*(?:;|,|\bor\b|\|)\s*/i).map((c) => c.trim()).filter(Boolean).flatMap((c) => /hz/i.test(c) ? [c] : splitParts(c));
	const removed = [];
	const kept = [];
	for (const p of parts) {
		const euroV = EURO_VOLT.test(p) && !US_VOLT.test(p);
		const fifty = FIFTY_ONLY.test(p) && !SIXTY.test(p) && !FIFTY_SIXTY.test(p);
		if (euroV || fifty) removed.push(p);
		else kept.push(FIFTY_SIXTY.test(p) ? p.replace(FIFTY_SIXTY, "60 Hz") : p);
	}
	if (!removed.length && !FIFTY_SIXTY.test(v)) return {
		kept: v,
		removed: []
	};
	if (!removed.length) return {
		kept: kept.join(", "),
		removed: ["50 Hz"]
	};
	return {
		kept: kept.join(", "),
		removed
	};
}
function filterPlug(v) {
	const parts = splitParts(v);
	const removed = parts.filter((p) => NON_US_PLUG.test(p) && !US_PLUG.test(p));
	if (!removed.length) return {
		kept: v,
		removed: []
	};
	return {
		kept: parts.filter((p) => !removed.includes(p)).join(", "),
		removed
	};
}
/** Certifications line: drop CE/UKCA/RoHS-type marks, keep UL/NSF/ETL/CSA. */
function filterCertLine(v) {
	const parts = v.split(/\s*(?:,|;|\s\/\s|\band\b|&|\+)\s*/i).map((p) => p.trim()).filter(Boolean);
	const removed = parts.filter((p) => !US_MARKS.test(p) && (NON_US_MARK_TOKENS.test(p) || NON_US_MARKS.test(p)));
	if (!removed.length) return {
		kept: v,
		removed: []
	};
	return {
		kept: parts.filter((p) => !removed.includes(p)).join(", "),
		removed
	};
}
/** Water/drain: metric-only standards and fittings (BSP/G threads, DIN/EN, °dH, bar-only, mm-only). */
function filterWater(v) {
	const parts = splitParts(v);
	const removed = parts.filter((p) => METRIC_WATER.test(p) || METRIC_ONLY_UNIT.test(p) && !IMPERIAL.test(p));
	if (!removed.length) return {
		kept: v,
		removed: []
	};
	return {
		kept: parts.filter((p) => !removed.includes(p)).join(", "),
		removed
	};
}
/** Contact: drop non-US phone numbers / addresses; keep US ones. */
function filterContact(v) {
	const lines = v.split(/\s*(?:\n|;|\s\|\s)\s*/).map((l) => l.trim()).filter(Boolean);
	const removed = lines.filter((l) => {
		const foreignPhone = NON_US_PHONE.test(l);
		const foreign = foreignPhone || NON_US_PLACE.test(l);
		const us = /\+\s?1[\s\-(]/.test(l) || US_STATE_ZIP.test(l) || /\b(usa|united states|america)\b/i.test(l) || !foreignPhone && US_PHONE.test(l);
		return foreign && !us;
	});
	if (!removed.length) return {
		kept: v,
		removed: []
	};
	return {
		kept: lines.filter((l) => !removed.includes(l)).join("; "),
		removed
	};
}
var NOTE = {
	voltage: "220–240 V / 400 V is not a US supply",
	frequency: "50 Hz is not used in the US",
	certification: "CE/UKCA/RoHS-type mark — not a US listing",
	plug: "Non-US plug type",
	water: "Metric-only water standard or fitting",
	contact: "Non-US manufacturer contact",
	config: "Configuration is for a non-US supply"
};
/** Which rule applies to a spec row, by its label. */
function ruleForLabel(label) {
	const l = label.toLowerCase();
	if (/certif|approval|listing|standard|compliance|marking/.test(l)) return {
		rule: filterCertLine,
		reason: "certification"
	};
	if (/plug|cord|connector/.test(l)) return {
		rule: filterPlug,
		reason: "plug"
	};
	if (/frequen|\bhz\b/.test(l)) return {
		rule: filterHz,
		reason: "frequency"
	};
	if (/volt|electr|power supply|supply|mains|power/.test(l)) return {
		rule: filterElectrical,
		reason: "voltage"
	};
	if (/water|drain|inlet|pressure|hardness|fitting|filtration/.test(l)) return {
		rule: filterWater,
		reason: "water"
	};
	if (/contact|phone|distribut|address|headquart|office|manufacturer/.test(l)) return {
		rule: filterContact,
		reason: "contact"
	};
	return null;
}
var FIELD_RULES = {
	power: {
		voltage: {
			rule: filterElectrical,
			reason: "voltage"
		},
		hz: {
			rule: filterHz,
			reason: "frequency"
		},
		plug: {
			rule: filterPlug,
			reason: "plug"
		},
		circuit: {
			rule: filterElectrical,
			reason: "voltage"
		},
		amps: {
			rule: filterElectrical,
			reason: "voltage"
		}
	},
	water: {
		inlet: {
			rule: filterWater,
			reason: "water"
		},
		pressure: {
			rule: filterWater,
			reason: "water"
		},
		filtration: {
			rule: filterWater,
			reason: "water"
		},
		notes: {
			rule: filterWater,
			reason: "water"
		}
	},
	drain: {
		size: {
			rule: filterWater,
			reason: "water"
		},
		notes: {
			rule: filterWater,
			reason: "water"
		}
	}
};
var SECTION_NAME = {
	power: "Power",
	water: "Water",
	drain: "Drain",
	dimensions: "Size"
};
var FIELD_NAME = {
	voltage: "Voltage",
	amps: "Amps",
	phase: "Phase",
	hz: "Hz",
	plug: "Plug",
	circuit: "Circuit",
	inlet: "Inlet",
	pressure: "Pressure",
	filtration: "Filtration",
	notes: "Notes",
	size: "Size"
};
/** A configuration whose label says it is a European build ("230V 50Hz", "CE version"). */
function nonUsConfigLabel(label) {
	const l = label.trim();
	if (!l) return false;
	if (US_VOLT.test(l) || SIXTY.test(l) || /\b(us|usa|ul|nsf|north america)\b/i.test(l)) return false;
	return (EURO_VOLT.test(l) || FIFTY_ONLY.test(l) && !FIFTY_SIXTY.test(l) || /\b(ce|uk|eu|europe(an)?|export)\s*(version|model|spec)?\b/i.test(l)) && true;
}
/**
* Run every rule over a draft. Returns the trimmed draft and the list of removals
* (in display order). Never throws; values it can't judge are left alone.
*/
function filterNonUsa(input) {
	const draft = structuredClone(input);
	const removed = [];
	let seq = 0;
	const add = (item) => removed.push({
		...item,
		id: `r${++seq}`,
		note: NOTE[item.reason]
	});
	const keptConfigs = [];
	draft.configs.forEach((c, i) => {
		if (draft.configs.length > 1 && nonUsConfigLabel(c.label)) add({
			where: `Configuration · ${c.label}`,
			removed: c.label,
			original: c,
			kept: "",
			reason: "config",
			path: {
				kind: "config",
				index: i
			}
		});
		else keptConfigs.push(c);
	});
	draft.configs = keptConfigs;
	draft.configs.forEach((c) => {
		for (const [section, fields] of Object.entries(FIELD_RULES)) {
			const sec = c.requirements[section];
			if (!sec) continue;
			for (const [key, { rule, reason }] of Object.entries(fields)) {
				const value = sec[key];
				if (!value) continue;
				const res = rule(value);
				if (!res.removed.length) continue;
				sec[key] = res.kept || void 0;
				add({
					where: `${c.label} · ${SECTION_NAME[section]} · ${FIELD_NAME[key] ?? key}`,
					removed: res.removed.join(", "),
					original: value,
					kept: res.kept,
					reason,
					path: {
						kind: "field",
						section,
						key,
						config: c.label
					}
				});
			}
		}
		const other = c.requirements.other ?? [];
		const keepOther = [];
		other.forEach((row, oi) => {
			const r = ruleForLabel(row.label);
			const res = r ? r.rule(row.value) : {
				kept: row.value,
				removed: []
			};
			if (r && res.removed.length) {
				add({
					where: `${c.label} · ${row.label}`,
					removed: res.removed.join(", "),
					original: row,
					kept: res.kept,
					reason: r.reason,
					path: {
						kind: "other",
						config: c.label,
						index: oi
					}
				});
				if (res.kept) keepOther.push({
					...row,
					value: res.kept
				});
			} else keepOther.push(row);
		});
		if (c.requirements.other) c.requirements.other = keepOther;
	});
	const keepSpecs = [];
	draft.specs.forEach((row, i) => {
		const r = ruleForLabel(row.label);
		const res = r ? r.rule(row.value) : {
			kept: row.value,
			removed: []
		};
		if (r && res.removed.length) {
			add({
				where: `Specs · ${row.label}`,
				removed: res.removed.join(", "),
				original: row,
				kept: res.kept,
				reason: r.reason,
				path: {
					kind: "spec",
					index: i
				}
			});
			if (res.kept) keepSpecs.push({
				...row,
				value: res.kept
			});
		} else keepSpecs.push(row);
	});
	draft.specs = keepSpecs;
	const certs = draft.mfrNotes.certifications ?? [];
	const keepCerts = [];
	certs.forEach((cert, i) => {
		const res = filterCertLine(cert);
		if (res.removed.length) {
			add({
				where: "Certifications",
				removed: res.removed.join(", "),
				original: cert,
				kept: res.kept,
				reason: "certification",
				path: {
					kind: "cert",
					index: i
				}
			});
			if (res.kept) keepCerts.push(res.kept);
		} else keepCerts.push(cert);
	});
	draft.mfrNotes.certifications = keepCerts;
	if (draft.mfrNotes.usContact) {
		const value = draft.mfrNotes.usContact;
		const res = filterContact(value);
		if (res.removed.length) {
			draft.mfrNotes.usContact = res.kept || void 0;
			add({
				where: "US Contact",
				removed: res.removed.join("; "),
				original: value,
				kept: res.kept,
				reason: "contact",
				path: {
					kind: "mfr",
					key: "usContact"
				}
			});
		}
	}
	return {
		draft,
		removed
	};
}
/** Put one removed value back into a draft (the review screen's Restore button). */
function restoreRemoved(draft, item) {
	const next = structuredClone(draft);
	const p = item.path;
	const at = (arr, index, value, replaceWhere) => {
		const hit = replaceWhere ? arr.findIndex(replaceWhere) : -1;
		if (hit >= 0) arr[hit] = value;
		else arr.splice(Math.min(index, arr.length), 0, value);
	};
	if (p.kind === "config") at(next.configs, p.index, item.original);
	else if (p.kind === "field") {
		const cfg = next.configs.find((c) => c.label === p.config);
		if (cfg) {
			const reqs = cfg.requirements;
			reqs[p.section] = {
				...reqs[p.section] ?? {},
				[p.key]: item.original
			};
		}
	} else if (p.kind === "other") {
		const cfg = next.configs.find((c) => c.label === p.config);
		if (cfg) {
			const row = item.original;
			cfg.requirements.other = cfg.requirements.other ?? [];
			at(cfg.requirements.other, p.index, row, (x) => x.label === row.label);
		}
	} else if (p.kind === "spec") {
		const row = item.original;
		at(next.specs, p.index, row, (x) => x.label === row.label);
	} else if (p.kind === "cert") {
		const certs = next.mfrNotes.certifications = next.mfrNotes.certifications ?? [];
		const hit = item.kept ? certs.indexOf(item.kept) : -1;
		if (hit >= 0) certs[hit] = item.original;
		else at(certs, p.index, item.original);
	} else if (p.kind === "mfr") next.mfrNotes[p.key] = item.original;
	return next;
}
var DEFAULT_INLET = "3/8\" compression valve";
var HARDWIRE_ONLY = "Hardwire only";
/** 3-phase from the phase field, or from voltage/plug text ("3ph", "3-phase", "3Ø", "3N~"). */
function isThreePhase(p) {
	if (!p) return false;
	const phase = (p.phase ?? "").trim().toLowerCase();
	if (/^(3|three)\b|3\s*-?\s*(ph|phase)|three[\s-]*phase|3\s*ø/.test(phase)) return true;
	const text = `${p.voltage ?? ""} ${p.circuit ?? ""} ${p.plug ?? ""}`.toLowerCase();
	return /\b3\s*-?\s*(ph|phase)\b|three[\s-]*phase|3\s*ø|\b3\s*n\s*~|\b3n\b|\bl15-|\bl21-|\b15-\d\dp?\b/.test(text);
}
function voltageClass(p) {
	if (isThreePhase(p)) return "three-phase";
	const nums = ((p?.voltage ?? "").toLowerCase().match(/\d{3}/g) ?? []).map(Number);
	if (nums.some((n) => n >= 200 && n <= 250)) return "240";
	if (nums.some((n) => n >= 100 && n <= 130)) return "120";
	return "unknown";
}
/** Largest amp figure on the spec ("20A / 30A" → 30). Null when there isn't one. */
function specAmps(p) {
	const nums = ((p?.amps ?? "").match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter((n) => n > 0 && n < 1e3);
	return nums.length ? Math.max(...nums) : null;
}
var STANDARD_BREAKERS = [
	15,
	20,
	25,
	30,
	35,
	40,
	45,
	50,
	60,
	70,
	80,
	90,
	100,
	110,
	125,
	150,
	175,
	200
];
/** Next standard breaker at or above 125% of the load (NEC continuous-load sizing). */
function breakerFor(amps) {
	const need = amps * 1.25;
	return STANDARD_BREAKERS.find((b) => b >= need - 1e-9) ?? Math.ceil(need / 10) * 10;
}
function sheetSaysLocking(plug) {
	const m = (plug ?? "").toUpperCase().match(/\bL(5|6|14)-(15|20|30)P?\b/);
	return m ? `L${m[1]}-${m[2]}` : null;
}
var WIRES_4 = "4-wire (2 hots, neutral, ground)";
var WIRES_3 = "3-wire (2 hots, ground)";
var WIRE_MISSING_NOTE = "Wire count missing — confirm 3-wire L6 or 4-wire L14.";
/** Model exceptions: units known to be 4-wire at 208–240 V. */
var FOUR_WIRE_MODELS = [/\bbunn\b.*\baxiom\b|\baxiom\b.*\bbunn\b|^axiom\b/i];
/** Plug text we wrote ourselves ("NEMA L6-30 twist-lock") is not evidence of the wiring. */
function isOurPlug(plug) {
	return /^NEMA (L?\d+-\d+)( twist-lock)?$/.test((plug ?? "").trim());
}
/**
* How many wires the 208–240 V supply uses: 4 = two hots + neutral + ground (L14), 3 = two hots + ground (L6).
* Checked in order: the Wires field, the electrical text, model exceptions, the manufacturer's own plug.
*/
function wireCount(p, ctx) {
	const field = (p?.wires ?? "").toLowerCase();
	if (/\b4\b|four/.test(field)) return {
		count: 4,
		source: "field"
	};
	if (/\b3\b|three/.test(field)) return {
		count: 3,
		source: "field"
	};
	const text = `${p?.voltage ?? ""} ${p?.circuit ?? ""}`.toLowerCase();
	const plus = text.match(/\b(\d)\s*-?\s*(?:wire|w)\s*(?:\+|plus|&|and|w\/|with)\s*(?:gnd|ground)/);
	if (plus) {
		const n = Number(plus[1]) + 1;
		if (n === 3 || n === 4) return {
			count: n,
			source: "text"
		};
	}
	const bare = text.match(/\b([34])\s*-?\s*(?:wire|conductor)s?\b/);
	if (bare) return {
		count: Number(bare[1]),
		source: "text"
	};
	if (/neutral/.test(text) || /\b(115|120)\s*\/\s*(208|220|230|240)\b/.test(text)) return {
		count: 4,
		source: "text"
	};
	const who = `${ctx?.manufacturer ?? ""} ${ctx?.model ?? ""}`.trim();
	if (who && FOUR_WIRE_MODELS.some((re) => re.test(who))) return {
		count: 4,
		source: "model"
	};
	const plug = p?.plug ?? "";
	if (plug && !isOurPlug(plug)) {
		const code = nemaCode(plug);
		if (code && /^L?14-/.test(code)) return {
			count: 4,
			source: "plug"
		};
		if (code && /^L?6-/.test(code)) return {
			count: 3,
			source: "plug"
		};
	}
	return {
		count: null,
		source: null
	};
}
var DEFAULT_NOTE = "Default — amps aren't on the sheet. Change it if the nameplate says otherwise.";
function over50(amps) {
	return `Draws ${amps}A — above a 50A plug. Confirm with the electrician; it may need to be hardwired.`;
}
/** Decide plug + breaker for one configuration's power block: volts, then wire count, then amps. */
function decidePlug(p, ctx) {
	const cls = voltageClass(p);
	const amps = specAmps(p);
	if (cls === "three-phase") return {
		plug: HARDWIRE_ONLY,
		nema: null,
		breaker: amps ? `${breakerFor(amps)}A 3-pole` : "3-pole, size from the nameplate",
		note: null,
		cls,
		wires: null
	};
	if (cls === "240") {
		const w = wireCount(p, ctx);
		if (w.count == null) return {
			plug: null,
			nema: null,
			breaker: amps == null ? null : amps <= 20 ? "20A 2-pole" : amps <= 30 ? "30A 2-pole" : "50A 2-pole",
			note: WIRE_MISSING_NOTE,
			cls,
			wires: null
		};
		if (w.count === 4) {
			const why = w.source === "model" ? "4-wire unit (model exception: 4-wire at 220V)." : "4-wire unit.";
			if (amps == null) return {
				plug: "NEMA L14-20 twist-lock",
				nema: "L14-20",
				breaker: "20A 2-pole",
				note: `${why} ${DEFAULT_NOTE}`,
				cls,
				wires: WIRES_4
			};
			if (amps <= 20) return {
				plug: "NEMA L14-20 twist-lock",
				nema: "L14-20",
				breaker: "20A 2-pole",
				note: why,
				cls,
				wires: WIRES_4
			};
			if (amps <= 30) return {
				plug: "NEMA L14-30 twist-lock",
				nema: "L14-30",
				breaker: "30A 2-pole",
				note: why,
				cls,
				wires: WIRES_4
			};
			return {
				plug: "NEMA 14-50",
				nema: "14-50",
				breaker: "50A 2-pole",
				note: amps > 50 ? over50(amps) : "4-wire above 30A: no L14 twist-lock face; 14-50 straight blade.",
				cls,
				wires: WIRES_4
			};
		}
		if (amps == null) return {
			plug: "NEMA L6-30 twist-lock",
			nema: "L6-30",
			breaker: "30A 2-pole",
			note: DEFAULT_NOTE,
			cls,
			wires: WIRES_3
		};
		if (amps <= 20) return {
			plug: "NEMA L6-20 twist-lock",
			nema: "L6-20",
			breaker: "20A 2-pole",
			note: null,
			cls,
			wires: WIRES_3
		};
		if (amps <= 30) return {
			plug: "NEMA L6-30 twist-lock",
			nema: "L6-30",
			breaker: "30A 2-pole",
			note: null,
			cls,
			wires: WIRES_3
		};
		return {
			plug: "NEMA 6-50",
			nema: "6-50",
			breaker: "50A 2-pole",
			note: amps > 50 ? over50(amps) : "Above 30A there is no L6 twist-lock; 6-50 straight blade.",
			cls,
			wires: WIRES_3
		};
	}
	if (cls === "120") {
		const already = sheetSaysLocking(p?.plug);
		if (already?.startsWith("L5") && !isOurPlug(p?.plug)) {
			const rating = Number(already.split("-")[1]);
			return {
				plug: `NEMA ${already} twist-lock`,
				nema: already,
				breaker: `${rating}A 1-pole`,
				note: null,
				cls,
				wires: null
			};
		}
		if (amps != null && amps > 15) return {
			plug: "NEMA 5-20",
			nema: "5-20",
			breaker: "20A 1-pole",
			note: amps > 20 ? `Draws ${amps}A — above a 20A plug. Confirm the circuit with the electrician.` : null,
			cls,
			wires: null
		};
		return {
			plug: "NEMA 5-15",
			nema: "5-15",
			breaker: "15A 1-pole",
			note: amps == null ? DEFAULT_NOTE : null,
			cls,
			wires: null
		};
	}
	return {
		plug: p?.plug ?? null,
		nema: nemaCode(p?.plug),
		breaker: null,
		note: null,
		cls,
		wires: null
	};
}
/** Note beside the plug: the 4-wire reason, the no-amps default, or the missing wire count. */
function defaultPlugNote(p, ctx) {
	const cls = voltageClass(p);
	if (cls === "240" && wireCount(p, ctx).count == null) return WIRE_MISSING_NOTE;
	if (!p?.plug) return null;
	const code = nemaCode(p.plug);
	const d = decidePlug(p, ctx);
	if (code && d.nema === code) return d.note;
	if (cls === "240" && code && /^L?14-/.test(code)) return "4-wire unit.";
	return null;
}
/** Save-time check: the plug must match volts and wire count (no L6 on 4-wire, no L14 on 3-wire, no L6/L14 on 120 V). */
function plugWireError(p, ctx) {
	const code = nemaCode(p?.plug);
	if (!code) return null;
	const cls = voltageClass(p);
	if (cls === "120" && /^L?(6|14)-/.test(code)) return `NEMA ${code} is a 208–240V plug; this configuration is 120V.`;
	if (cls === "240" && /^L?5-/.test(code)) return `NEMA ${code} is a 120V plug; this configuration is 208–240V.`;
	if (cls !== "240") return null;
	const w = wireCount({
		...p,
		plug: void 0
	}, ctx).count;
	if (w === 4 && /^L?6-/.test(code)) return `NEMA ${code} is 3-wire; this unit is 4-wire (needs L14).`;
	if (w === 3 && /^L?14-/.test(code)) return `NEMA ${code} is 4-wire; this unit is 3-wire (needs L6).`;
	return null;
}
/** "NEMA L6-30 twist-lock" → "L6-30"; "NEMA 5-15P" → "5-15". Null for hardwire or non-NEMA text. */
function nemaCode(plug) {
	const t = (plug ?? "").toUpperCase();
	if (!t || /HARD\s*-?\s*WIRE/.test(t)) return null;
	const m = t.match(/\b(L?)(5|6|14|15)-(15|20|30|50)P?\b/);
	return m ? `${m[1]}${m[2]}-${m[3]}` : null;
}
function applyConfigDefaults(c, mode, ctx) {
	const req = c.requirements ?? {};
	const water = { ...req.water ?? {} };
	if (mode === "generate" || !water.inlet?.trim()) water.inlet = DEFAULT_INLET;
	const power = { ...req.power ?? {} };
	const d = decidePlug(power, ctx);
	if (d.cls !== "unknown") {
		if (d.wires && (mode === "generate" || !power.wires?.trim())) power.wires = d.wires;
		if (mode === "generate" || !power.plug?.trim()) power.plug = d.plug ?? void 0;
		if (mode === "generate" || !power.breaker?.trim()) power.breaker = d.breaker ?? void 0;
	}
	const hasPower = Object.values(power).some((v) => typeof v === "string" && v.trim());
	return {
		...c,
		requirements: {
			...req,
			water,
			...hasPower ? { power } : {}
		}
	};
}
function applySpecDefaults(draft, mode) {
	const configs = draft.configs.length ? draft.configs : [{
		label: "Standard",
		requirements: {}
	}];
	const core = espressoCoreDefaults(draft);
	const ctx = {
		manufacturer: draft.manufacturer,
		model: draft.model
	};
	return {
		...draft,
		...core,
		configs: configs.map((c) => applyConfigDefaults(c, mode, ctx))
	};
}
var ESPRESSO_MAKERS = /\b(la\s*marzocco|eversys|rancilio|faema|slayer|synesso|nuova\s*simonelli|victoria\s*arduino|franke|schaerer|thermoplan|wmf|cimbali)\b/i;
/** Espresso machine: La Marzocco, Eversys, Rancilio, Faema… or a catalog/category marked espresso. Grinders don't count. */
function isEspresso(sheet) {
	const text = `${sheet.manufacturer ?? ""} ${sheet.model ?? ""}`;
	const cat = sheet.category ?? "";
	if (/grinder|brewer|water|filtration|fridge|refrigerat|blender|dispenser/i.test(cat)) return false;
	if (/espresso/i.test(cat) || /espresso\s*(machine)?\b/i.test(text) && !/grinder/i.test(text)) return true;
	if (/grinder|fridge/i.test(text)) return false;
	return ESPRESSO_MAKERS.test(text) || isEversysMachine(sheet.model) || isEversysMachine(text);
}
/** 3 → 3"; 3 in → 3"; 76 mm stays as typed. */
function normalizeDiameter(v) {
	const t = (v ?? "").trim();
	if (!t) return void 0;
	if (/^\d+(\.\d+)?$/.test(t)) return `${t}"`;
	const inch = t.match(/^(\d+(?:\.\d+)?)\s*(in|inch|inches|”|")\.?$/i);
	return inch ? `${inch[1]}"` : t;
}
/** Espresso sheets get core hole Yes and 3" unless the sheet already says otherwise. Never invents 3" for others. */
function espressoCoreDefaults(sheet) {
	const diameter = normalizeDiameter(sheet.coreDiameter);
	if (isEspresso(sheet)) {
		const hole = sheet.coreHole ?? "yes";
		return {
			coreHole: hole,
			coreDiameter: hole === "yes" ? diameter ?? "3\"" : diameter
		};
	}
	return {
		coreHole: sheet.coreHole,
		coreDiameter: diameter
	};
}
function coreHoleInfo(sheet, preInspectionSaysYes = false) {
	const d = espressoCoreDefaults(sheet);
	if (!(d.coreHole === "yes" || preInspectionSaysYes)) return {
		required: false,
		diameter: null,
		label: null,
		missingDiameter: false
	};
	const diameter = d.coreDiameter ?? null;
	return {
		required: true,
		diameter,
		label: diameter ? `Counter core hole: ${diameter} diameter` : "Counter core hole: diameter needed",
		missingDiameter: !diameter
	};
}
/** Blocks saving a spec that needs a core hole but has no diameter. */
function coreHoleSaveError(sheet) {
	return coreHoleInfo(sheet).missingDiameter ? "Counter core hole is Yes — add the hole diameter before saving." : null;
}
/**
* The Library — data shapes for spec sheets. Pure (zod only) so node --test can import it.
* Every field is optional except the machine identity; the UI hides empty ones.
*/
/** Accept what an LLM tends to send: null/"" → missing, numbers → strings. */
var text = preprocess((v) => {
	if (v === null || v === void 0) return void 0;
	if (typeof v === "number" || typeof v === "boolean") return String(v);
	if (typeof v === "string") {
		const t = v.trim();
		return t ? t : void 0;
	}
	return v;
}, string().max(2e3).optional());
var list = (item) => preprocess((v) => v === null || v === void 0 ? [] : v, array(item).max(200));
var str = (max) => preprocess((v) => typeof v === "number" || typeof v === "boolean" ? String(v) : v ?? "", string().trim().max(max));
var kvSchema = object({
	label: str(200).pipe(string().min(1)),
	value: str(2e3)
});
var powerSchema = object({
	voltage: text,
	amps: text,
	/** Breaker size recommendation, shown under Amps (e.g. "30A 2-pole"). */
	breaker: text,
	/** 208–240 V wiring: "4-wire (2 hots, neutral, ground)" → L14, "3-wire (2 hots, ground)" → L6. */
	wires: text,
	phase: text,
	hz: text,
	plug: text,
	circuit: text
});
var waterSchema = object({
	inlet: text,
	pressure: text,
	filtration: text,
	notes: text
});
var drainSchema = object({
	size: text,
	notes: text
});
var dimensionsSchema = object({
	width: text,
	depth: text,
	height: text,
	weight: text,
	clearance: text
});
var section = (s) => preprocess((v) => v === null ? void 0 : v, s.optional());
var requirementsSchema = object({
	power: section(powerSchema),
	water: section(waterSchema),
	drain: section(drainSchema),
	dimensions: section(dimensionsSchema),
	other: list(kvSchema).optional()
});
var mfrNotesSchema = object({
	usContact: text,
	warranty: text,
	certifications: preprocess((v) => typeof v === "string" ? v.split(/[,;]/).map((x) => x.trim()).filter(Boolean) : v ?? [], array(string().trim().min(1).max(200)).max(50)).optional()
});
var configSchema = object({
	label: preprocess((v) => typeof v === "string" && v.trim() ? v : "Standard", string().trim().max(200)),
	requirements: preprocess((v) => v ?? {}, requirementsSchema)
});
var imageField = string().max(14e5).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, "Not an image").nullable().optional();
/** What the AI must return, and what the review form edits. */
var specSheetSchema = object({
	manufacturer: string().trim().max(200),
	model: string().trim().max(200),
	category: text,
	summary: text,
	specs: list(kvSchema),
	mfrNotes: preprocess((v) => v ?? {}, mfrNotesSchema),
	configs: list(configSchema),
	/** Counter core hole for utility lines: "yes" | "no"; undefined = not stated. */
	coreHole: preprocess((v) => {
		if (v === true) return "yes";
		if (v === false) return "no";
		const t = typeof v === "string" ? v.trim().toLowerCase() : "";
		return t === "yes" || t === "no" ? t : void 0;
	}, _enum(["yes", "no"]).optional()),
	coreDiameter: text,
	/**
	* Equipment image from the spec sheet (data URL). On save: undefined keeps the stored one,
	* null removes it, a string replaces it.
	*/
	image: imageField,
	/** Dimension diagram (secondary image). Same keep / remove / replace rules as image. */
	dimsImage: imageField
});
function emptyDraft() {
	return {
		manufacturer: "",
		model: "",
		category: void 0,
		summary: void 0,
		specs: [],
		mfrNotes: { certifications: [] },
		configs: [{
			label: "Standard",
			requirements: { water: { inlet: "3/8\" compression valve" } }
		}]
	};
}
/**
* Pull the JSON object out of a model reply (it may wrap it in ```json fences or add a sentence)
* and validate it. Returns a readable error instead of throwing.
*/
function parseExtraction(raw) {
	let body = raw.trim();
	const fence = body.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fence) body = fence[1].trim();
	const start = body.indexOf("{");
	const end = body.lastIndexOf("}");
	if (start < 0 || end <= start) return {
		ok: false,
		error: "No JSON object in the reply."
	};
	let json;
	try {
		json = JSON.parse(body.slice(start, end + 1));
	} catch (e) {
		return {
			ok: false,
			error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`
		};
	}
	const parsed = specSheetSchema.safeParse(json);
	if (!parsed.success) {
		const first = parsed.error.issues[0];
		return {
			ok: false,
			error: `Schema mismatch at ${first?.path.join(".") || "root"}: ${first?.message ?? "invalid"}`
		};
	}
	return {
		ok: true,
		data: parsed.data
	};
}
/** Drop empty strings/sections so saved JSON stays small and the UI can hide blanks. */
function compactDraft(d) {
	const clean = (o) => {
		if (!o) return void 0;
		const out = {};
		for (const [k, v] of Object.entries(o)) if (typeof v === "string" ? v.trim() : v !== void 0 && v !== null) out[k] = typeof v === "string" ? v.trim() : v;
		return Object.keys(out).length ? out : void 0;
	};
	const kvs = (l) => (l ?? []).filter((k) => k.label.trim() && k.value.trim());
	return {
		manufacturer: d.manufacturer.trim(),
		model: d.model.trim(),
		category: d.category?.trim() || void 0,
		coreHole: d.coreHole,
		coreDiameter: d.coreDiameter?.trim() || void 0,
		image: d.image,
		dimsImage: d.dimsImage,
		summary: d.summary?.trim() || void 0,
		specs: kvs(d.specs),
		mfrNotes: {
			usContact: d.mfrNotes.usContact?.trim() || void 0,
			warranty: d.mfrNotes.warranty?.trim() || void 0,
			certifications: (d.mfrNotes.certifications ?? []).map((c) => c.trim()).filter(Boolean)
		},
		configs: d.configs.map((c, i) => ({
			label: c.label.trim() || `Configuration ${i + 1}`,
			requirements: {
				power: clean(c.requirements.power),
				water: clean(c.requirements.water),
				drain: clean(c.requirements.drain),
				dimensions: clean(c.requirements.dimensions),
				other: kvs(c.requirements.other)
			}
		}))
	};
}
//#endregion
export { specSheetSchema as _, compactDraft as a, defaultPlugNote as c, filterNonUsa as d, isEspresso as f, restoreRemoved as g, plugWireError as h, applySpecDefaults as i, emptyDraft as l, parseExtraction as m, WIRES_4 as n, coreHoleInfo as o, nemaCode as p, applyConfigDefaults as r, coreHoleSaveError as s, WIRES_3 as t, espressoCoreDefaults as u };
