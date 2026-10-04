import { t as normalizeName } from "./norm-_aMMQVT6.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/pre-inspection-XP9-2z1S.js
/** Site check before an install. One record per install. */
var INSPECTION_CATEGORIES = [
	{
		key: "power",
		label: "Power",
		pass: "Correct voltage/phase/outlet present and reachable for the equipment"
	},
	{
		key: "water",
		label: "Water",
		pass: "Dedicated supply, shutoff, and line ready for the spec"
	},
	{
		key: "drain",
		label: "Drain",
		pass: "Gravity drain or pump plan, correct location"
	},
	{
		key: "ethernet",
		label: "Ethernet",
		pass: "Drop/port present if the machine needs telemetry/network"
	},
	{
		key: "space",
		label: "Space",
		pass: "Clearance, counter depth/height, access for the listed equipment"
	}
];
/** Not one of the five lines. Counted only when this machine answered Yes. */
var CORE_HOLE_CATEGORY = "core";
var CORE_HOLE_LABEL = "Counter core / utility pass-through";
var CORE_HOLE_QUESTION = "Does the customer need a hole cored in the counter to pass utility lines through?";
var INSPECTION_ITEM_STATUSES = [
	"Not inspected",
	"Pass",
	"Fail",
	"N/A"
];
function isInspectionCategory(v) {
	return INSPECTION_CATEGORIES.some((c) => c.key === v);
}
function isCoreHoleAnswer(v) {
	return v === "yes" || v === "no";
}
/** The five site lines, plus the core-hole line when that machine needs one. */
function isSavableCategory(v) {
	return isInspectionCategory(v) || v === "core";
}
function isInspectionItemStatus(v) {
	return INSPECTION_ITEM_STATUSES.includes(v ?? "");
}
function categoryLabel(key) {
	if (key === "core") return CORE_HOLE_LABEL;
	return INSPECTION_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}
function emptyInspection() {
	return {
		overall: "Not started",
		failedItems: [],
		photoCount: 0,
		overrideReason: null,
		machineCount: 0,
		passedCount: 0
	};
}
function failedItemLabels(items, coreNeeded) {
	const labels = INSPECTION_CATEGORIES.filter((c) => items.some((i) => i.category === c.key && i.status === "Fail")).map((c) => c.label);
	if (coreNeeded === "yes" && items.some((i) => i.category === "core" && i.status === "Fail")) labels.push(CORE_HOLE_LABEL);
	return labels;
}
/** Not started / in progress / failed / passed. Fail wins. Pass or N/A on every counted line passes. */
function inspectionOverall(items, coreNeeded) {
	const statuses = INSPECTION_CATEGORIES.map((c) => {
		return items.find((i) => i.category === c.key)?.status ?? "Not inspected";
	});
	if (coreNeeded === "yes") {
		const hit = items.find((i) => i.category === CORE_HOLE_CATEGORY);
		statuses.push(hit?.status ?? "Not inspected");
	}
	if (statuses.every((s) => s === "Not inspected")) return "Not started";
	if (statuses.some((s) => s === "Fail")) return "Failed";
	if (statuses.every((s) => s === "Pass" || s === "N/A")) return "Passed";
	return "In progress";
}
function summarizeInspection(items, photoCount, overrideReason, coreNeeded) {
	const overall = inspectionOverall(items, coreNeeded);
	return {
		overall,
		failedItems: failedItemLabels(items, coreNeeded),
		photoCount,
		overrideReason: (overrideReason ?? "").trim() || null,
		machineCount: 1,
		passedCount: overall === "Passed" ? 1 : 0
	};
}
/** Site rollup. Passed only when every machine is Passed. Any Fail fails the site. */
function rollupSite(machines, overrideReason) {
	if (!machines.length) return {
		...emptyInspection(),
		overrideReason: (overrideReason ?? "").trim() || null
	};
	const each = machines.map((m) => summarizeInspection(m.items, m.photoCount, null, m.coreNeeded));
	const failedItems = [...INSPECTION_CATEGORIES.map((c) => c.label), CORE_HOLE_LABEL].filter((label) => each.some((m) => m.failedItems.includes(label)));
	let overall = "In progress";
	if (each.some((m) => m.overall === "Failed")) overall = "Failed";
	else if (each.every((m) => m.overall === "Passed")) overall = "Passed";
	else if (each.every((m) => m.overall === "Not started")) overall = "Not started";
	return {
		overall,
		failedItems,
		photoCount: each.reduce((n, m) => n + m.photoCount, 0),
		overrideReason: (overrideReason ?? "").trim() || null,
		machineCount: each.length,
		passedCount: each.filter((m) => m.overall === "Passed").length
	};
}
/**
* Hide the question when Space is N/A, unless Yes or No is already stored.
* A local status that is not N/A (for example Pass, not saved yet) still shows it.
*/
function showCoreHoleQuestion(spaceStatus, coreNeeded) {
	if (isCoreHoleAnswer(coreNeeded)) return true;
	return (spaceStatus ?? "Not inspected") !== "N/A";
}
function categoryHint(category, unit) {
	const model = (unit.model ?? "").trim();
	const electrical = (unit.electrical ?? "").trim();
	if (category === "core") {
		const base = "Hole through the counter so utility lines can pass";
		return model ? `${base}. For ${model}.` : base;
	}
	const base = INSPECTION_CATEGORIES.find((c) => c.key === category)?.pass ?? "";
	if (category === "power" && electrical) return `${base}. This unit calls for ${electrical}.`;
	if (category === "power" && model) return `${base}. Check the nameplate on ${model}.`;
	if (model) return `${base}. For ${model}.`;
	return base;
}
/** N/A needs a note. Pass and Fail need a photo. */
function itemSaveError(input) {
	if (!isInspectionItemStatus(input.status)) return "Pick a status.";
	if (input.status === "N/A" && !(input.notes ?? "").trim()) return "N/A needs a short note.";
	if ((input.status === "Pass" || input.status === "Fail") && input.photoCount < 1) return "Add at least one photo before Pass or Fail.";
	return null;
}
/** Space cannot be saved as Pass until this machine has a Yes or No. */
function spacePassError(input) {
	const base = itemSaveError(input);
	if (base) return base;
	if (input.status === "Pass" && !isCoreHoleAnswer(input.coreNeeded)) return "Answer Yes or No on the core hole before Space can pass.";
	return null;
}
function canMarkInstalled(summary) {
	if (!summary) return false;
	if (summary.overall === "Passed") return true;
	return !!(summary.overrideReason ?? "").trim();
}
/** Ready to go on site: equipment already Ready and the site check passed. */
function siteIsReady(equipStatus, overall) {
	return equipStatus === "Ready" && overall === "Passed";
}
function photosCell(count) {
	return count > 0 ? String(count) : "No";
}
function inspectionGlance(summary) {
	const s = summary ?? emptyInspection();
	const count = s.machineCount > 0 ? ` ${s.passedCount}/${s.machineCount}` : "";
	if (s.overall === "Failed" && s.failedItems.length) return `Failed: ${s.failedItems.join(", ")}${count}`;
	return `${s.overall}${count}`;
}
function personKey(raw) {
	return normalizeName(raw.replace(/\s*\([^)]{1,8}\)\s*$/, ""));
}
/** Active sales reps plus active service techs. One row per person, name order. */
function inspectorChoices(reps, techs, current) {
	const byKey = /* @__PURE__ */ new Map();
	for (const rep of reps) {
		if (rep.active === false) continue;
		const name = rep.name.trim().replace(/\s+/g, " ");
		if (!name) continue;
		const initials = (rep.initials ?? "").trim();
		byKey.set(personKey(name), {
			value: name,
			label: initials ? `${name} (${initials})` : name
		});
	}
	for (const tech of techs) {
		if (tech.active === false) continue;
		const name = tech.name.trim().replace(/\s+/g, " ");
		if (!name || byKey.has(personKey(name))) continue;
		byKey.set(personKey(name), {
			value: name,
			label: name
		});
	}
	const options = [...byKey.values()].sort((a, b) => a.value.localeCompare(b.value, void 0, { sensitivity: "base" }));
	const cur = (current ?? "").trim();
	if (!cur) return {
		options,
		value: ""
	};
	const hit = options.find((o) => personKey(o.value) === personKey(cur) || normalizeName(o.label) === normalizeName(cur));
	if (hit) return {
		options,
		value: hit.value
	};
	return {
		options: [{
			value: cur,
			label: cur
		}, ...options],
		value: cur
	};
}
//#endregion
export { spacePassError as C, siteIsReady as S, isSavableCategory as _, INSPECTION_ITEM_STATUSES as a, rollupSite as b, categoryLabel as c, inspectionGlance as d, inspectionOverall as f, isInspectionItemStatus as g, isInspectionCategory as h, INSPECTION_CATEGORIES as i, emptyInspection as l, isCoreHoleAnswer as m, CORE_HOLE_LABEL as n, canMarkInstalled as o, inspectorChoices as p, CORE_HOLE_QUESTION as r, categoryHint as s, CORE_HOLE_CATEGORY as t, failedItemLabels as u, itemSaveError as v, showCoreHoleQuestion as x, photosCell as y };
