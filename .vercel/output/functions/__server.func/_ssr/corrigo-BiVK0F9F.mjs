//#region node_modules/.nitro/vite/services/ssr/assets/corrigo-BiVK0F9F.js
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
/** Corrigo walk-up / counter work — not a real KatzDesk account. */
function isWalkIn(name) {
	return String(name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "") === "walkin";
}
function normalizeCustomerKey(name) {
	return String(name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
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
export { parseCorrigoMatrix as a, shouldAttachToHit as c, isWalkIn as i, woCanonical as l, deskHasWrapped as n, pickKeeper as o, indexHits as r, resolvePreviewRow as s, customersCompatible as t, woMatchKey as u };
