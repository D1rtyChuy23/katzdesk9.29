import { r as __exportAll } from "../_runtime.mjs";
//#region src/lib/ops/warehouse.ts
var warehouse_exports = /* @__PURE__ */ __exportAll({
	BACK_EQUIP_CAPACITY: () => 672,
	BACK_PALLETS: () => BACK_PALLETS,
	BARN_EQUIP_CAPACITY: () => BARN_EQUIP_CAPACITY,
	DISPENSER_LINES: () => 96,
	FRONT_CAPACITY: () => 384,
	FRONT_PALLETS: () => FRONT_PALLETS,
	LEVELS: () => LEVELS,
	LOCATION_SITES: () => LOCATION_SITES,
	SITE_LABEL: () => SITE_LABEL,
	SITE_PURPOSE: () => SITE_PURPOSE,
	bayFor: () => bayFor,
	isBarn: () => isBarn,
	isValidBay: () => isValidBay,
	needsBay: () => needsBay,
	palletsFor: () => palletsFor,
	siteLabel: () => siteLabel,
	slotId: () => slotId
});
var BACK_PALLETS = [
	"A",
	"B",
	"C",
	"D",
	"E",
	"F",
	"G",
	"H",
	"I",
	"J",
	"K",
	"L",
	"M",
	"N",
	"O",
	"P"
];
var FRONT_PALLETS = [
	"I",
	"J",
	"K",
	"L",
	"M",
	"N",
	"O",
	"P"
];
var LEVELS = [
	4,
	3,
	2,
	1
];
var LOCATION_SITES = [
	"front-lobby",
	"service-room",
	"production",
	"training",
	"out-of-state",
	"san-antonio",
	"dallas"
];
var SITE_LABEL = {
	"barn-back": "Barn · back rack",
	"barn-front": "Barn · front rack",
	"front-lobby": "Lobby",
	"service-room": "Service Room",
	production: "Production",
	training: "Training",
	staging: "Staging area",
	"out-of-state": "Out of State",
	"san-antonio": "San Antonio",
	dallas: "Dallas",
	field: "Pulled from the barn",
	sold: "Sold"
};
var SITE_PURPOSE = {
	"front-lobby": "Lobby",
	"service-room": "Service bench",
	production: "Production",
	training: "Training",
	staging: "Staging area",
	"out-of-state": "Out of state",
	"san-antonio": "SA warehouse",
	dallas: "Dallas warehouse"
};
var BARN_EQUIP_CAPACITY = 1056;
var BAY_LETTERS = "ABCDEFGHIJKLMNOP";
function isValidBay(pallet) {
	if (!pallet) return false;
	const c = pallet.trim().toUpperCase();
	return c.length === 1 && BAY_LETTERS.includes(c);
}
function needsBay(site, pallet) {
	if (site !== "barn-back" && site !== "barn-front") return false;
	if (!pallet || !pallet.trim()) return true;
	const c = pallet.trim().toUpperCase();
	if (c === "Q" || c.length === 1 && c > "P") return true;
	return !isValidBay(c);
}
function bayFor(site, pallet) {
	if (site === "barn-back" && pallet) {
		const p = pallet.trim().toUpperCase();
		if ("ABCD".includes(p)) return "catering";
		if ("EF".includes(p)) return "dispenser";
	}
	return "general";
}
function palletsFor(site) {
	return site === "barn-front" ? FRONT_PALLETS : BACK_PALLETS;
}
function slotId(pallet, level, line) {
	return line ? `${pallet}-L${level} · ${line}` : `${pallet}-L${level}`;
}
function siteLabel(site) {
	return SITE_LABEL[site] ?? site;
}
function isBarn(site) {
	return site === "barn-back" || site === "barn-front";
}
//#endregion
export { LOCATION_SITES as a, bayFor as c, needsBay as d, palletsFor as f, warehouse_exports as h, LEVELS as i, isBarn as l, slotId as m, BARN_EQUIP_CAPACITY as n, SITE_LABEL as o, siteLabel as p, FRONT_PALLETS as r, SITE_PURPOSE as s, BACK_PALLETS as t, isValidBay as u };
