//#region node_modules/.nitro/vite/services/ssr/assets/library-file-rules-C8I0Azqy.js
/** Biggest single file. */
var MAX_FILE_BYTES = 20971520;
/** Files travel in pieces this size so each request stays small. */
var CHUNK_BYTES = 1048576;
var TYPES = {
	pdf: "application/pdf",
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	webp: "image/webp",
	gif: "image/gif",
	doc: "application/msword",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
};
var ACCEPT = Object.keys(TYPES).map((e) => `.${e}`).join(",");
var ALLOWED_TEXT = "PDF, images (PNG, JPG, WebP, GIF) and Word (DOC, DOCX)";
function fileExt(name) {
	const m = /\.([A-Za-z0-9]+)$/.exec(name.trim());
	return m ? m[1].toLowerCase() : "";
}
/** Content type from the file name — the browser's own guess is often blank or wrong. */
function mimeFor(name) {
	return TYPES[fileExt(name)] ?? null;
}
/** PDFs and pictures open in the browser tab; Word files can only download. */
function opensInline(mime) {
	return mime === "application/pdf" || mime.startsWith("image/");
}
function sizeText(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1048576) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	return `${(bytes / 1024 / 1024).toFixed(bytes < 10485760 ? 1 : 0)} MB`;
}
/** null when the file is fine, otherwise a sentence to show the person. */
function fileError(name, size) {
	const clean = name.trim();
	if (!clean) return "That file has no name.";
	if (!mimeFor(clean)) return `${clean} can't be added — only ${ALLOWED_TEXT} are accepted.`;
	if (size <= 0) return `${clean} is empty.`;
	if (size > 20971520) return `${clean} is too big (${sizeText(size)}). The limit is ${sizeText(MAX_FILE_BYTES)} per file.`;
	return null;
}
/** A–Z by file name, ignoring case; "Manual 2" before "Manual 10". */
function sortByName(files) {
	const stem = (n) => n.replace(/\.[A-Za-z0-9]+$/, "");
	const cmp = (a, b) => a.localeCompare(b, "en", {
		sensitivity: "base",
		numeric: true
	});
	return [...files].sort((a, b) => cmp(stem(a.name), stem(b.name)) || cmp(a.name, b.name) || a.name.localeCompare(b.name));
}
/** Full link on the app's own domain; opens the document for anyone who has it. */
function fileUrl(origin, token) {
	return `${origin.replace(/\/$/, "")}/api/library-file/${token}`;
}
function emailHref(name, url) {
	return `mailto:?subject=${encodeURIComponent(name)}&body=${encodeURIComponent(`${name}\n${url}`)}`;
}
/** "sms:?&body=" is the form both iPhone and Android accept. */
function textHref(name, url) {
	return `sms:?&body=${encodeURIComponent(`${name}: ${url}`)}`;
}
/** Shelf name inside a book, and the word used when a file is renamed "Family - Type". */
var SHELF = {
	spec: {
		title: "Spec Sheet",
		type: "Spec Sheet"
	},
	manuals: {
		title: "Manuals",
		type: "Manual"
	},
	parts: {
		title: "Parts Diagrams",
		type: "Parts Book"
	}
};
var clean = (s) => s.replace(/\s+/g, " ").trim();
var escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
var tokens = (s) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
/** The book for a spec sheet: maker + the full model name, variation included. Bunn + "Axiom DV-APS" → "Bunn Axiom DV-APS". */
function variationTitle(manufacturer, model) {
	const maker = clean(manufacturer);
	const m = clean(model);
	return maker && !m.toLowerCase().startsWith(maker.toLowerCase() + " ") && m.toLowerCase() !== maker.toLowerCase() ? clean(`${maker} ${m}`) : m;
}
var modelTokens = (b) => {
	const maker = b.manufacturer || makerOf(b.title);
	return tokens(modelLabel(b.title, maker));
};
/**
* Ways a book can be named in a file name: the whole title, or the whole model without the maker
* ("Bunn Axiom DV-APS" or "Axiom DV-APS"). Never part of the model — "Axiom" alone is not DV-APS.
*/
function bookKeys(title, manufacturer) {
	const model = modelTokens({
		title,
		manufacturer
	});
	const keys = [tokens(title)];
	if (model.join("").length >= 3 && model.length < keys[0].length) keys.push(model);
	return keys;
}
function keyLength(text, key) {
	return new RegExp(`(^|[^a-z0-9])${key.map(escapeRe).join("[^a-z0-9]*")}($|[^a-z])`, "i").test(text.toLowerCase()) ? key.join("").length : 0;
}
var startsWithTokens = (long, short) => long.length > short.length && short.every((t, i) => long[i] === t);
/**
* Which book a file name belongs to. Returns the book only when exactly one fits best AND no other
* variation of that same model exists that the name could also mean; otherwise null — the person picks.
*/
function matchBook(text, books) {
	let best = 0;
	let hits = [];
	for (const b of books) {
		const score = Math.max(0, ...bookKeys(b.title, b.manufacturer).map((k) => keyLength(text, k)));
		if (!score) continue;
		if (score > best) {
			best = score;
			hits = [b];
		} else if (score === best) hits.push(b);
	}
	if (hits.length !== 1) return null;
	const hit = hits[0];
	const mine = modelTokens(hit);
	if (books.some((b) => b.id !== hit.id && startsWithTokens(modelTokens(b), mine))) return null;
	return hit;
}
/** Books worth showing first in the picker: same maker or same first model word as the file name. */
function likelyBooks(text, books) {
	const words = new Set(tokens(text));
	return books.filter((b) => {
		const first = modelTokens(b)[0];
		return !!first && first.length >= 3 && words.has(first);
	});
}
/** "Bunn Axiom - Manual.pdf"; a second one becomes "Bunn Axiom - Manual 2.pdf". */
function shelfFileName(bookTitle, section, originalName, taken) {
	const ext = fileExt(originalName);
	const base = `${clean(bookTitle)} - ${SHELF[section].type}`;
	const stem = (n) => n.replace(/\.[A-Za-z0-9]+$/, "").toLowerCase();
	const used = new Set(taken.map(stem));
	for (let n = 1;; n++) {
		const name = n === 1 ? base : `${base} ${n}`;
		if (!used.has(name.toLowerCase())) return `${name}${ext ? `.${ext}` : ""}`;
	}
}
/** Makers with more than one word, or that staff add by hand before any spec sheet exists. */
var KNOWN_MAKERS = [
	"La Marzocco",
	"Nuova Simonelli",
	"Victoria Arduino",
	"Wilbur Curtis",
	"La Cimbali",
	"La Spaziale",
	"Bunn",
	"Fetco",
	"Eversys",
	"Curtis",
	"Rancilio",
	"Franke",
	"Schaerer",
	"Mahlkonig",
	"Mazzer",
	"Ditting",
	"Slayer",
	"Synesso",
	"Baratza",
	"Astoria",
	"Faema",
	"Thermoplan"
];
/** The maker a book title starts with: the longest known maker, else the first word. */
function makerOf(title, makers = []) {
	const t = clean(title);
	const lower = t.toLowerCase();
	return [...makers, ...KNOWN_MAKERS].map(clean).filter((m) => m && (lower === m.toLowerCase() || lower.startsWith(m.toLowerCase() + " "))).sort((a, b) => b.length - a.length)[0] ?? t.split(" ")[0] ?? t;
}
/** "Bunn Axiom" under Bunn → "Axiom". */
function modelLabel(title, maker) {
	const t = clean(title);
	return (t.toLowerCase().startsWith(maker.toLowerCase() + " ") ? t.slice(maker.length + 1) : t) || t;
}
/** Inside a model the family is already on screen: "Bunn Axiom - Manual 2.pdf" → "Manual 2". */
function shortDocName(name, bookTitle) {
	const stem = name.replace(/\.[A-Za-z0-9]+$/, "");
	const prefix = `${clean(bookTitle)} - `;
	return stem.toLowerCase().startsWith(prefix.toLowerCase()) ? stem.slice(prefix.length) : stem;
}
//#endregion
export { sizeText as _, SHELF as a, variationTitle as b, fileUrl as c, matchBook as d, mimeFor as f, shortDocName as g, shelfFileName as h, MAX_FILE_BYTES as i, likelyBooks as l, opensInline as m, ALLOWED_TEXT as n, emailHref as o, modelLabel as p, CHUNK_BYTES as r, fileError as s, ACCEPT as t, makerOf as u, sortByName as v, textHref as y };
