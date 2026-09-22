//#region node_modules/.nitro/vite/services/ssr/assets/warehouse-B30B9_go.js
var BACK_PALLETS = [
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
	"P",
	"Q"
];
var FRONT_PALLETS = [
	"J",
	"K",
	"L",
	"M",
	"N",
	"O",
	"P",
	"Q"
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
	"front-lobby": "Front Lobby",
	"service-room": "Service Room",
	"production": "Production",
	"training": "Training Room",
	"out-of-state": "Out of State",
	"san-antonio": "San Antonio",
	dallas: "Dallas",
	field: "Pulled from the barn",
	sold: "Sold"
};
var SITE_PURPOSE = {
	"front-lobby": "Front Lobby",
	"service-room": "Service bench",
	production: "Production",
	training: "Training",
	"out-of-state": "Out of state",
	"san-antonio": "SA warehouse",
	dallas: "Dallas warehouse"
};
var BARN_EQUIP_CAPACITY = 1056;
function bayFor(site, pallet) {
	if (site === "barn-back" && pallet) {
		if ("BCDE".includes(pallet)) return "catering";
		if ("FG".includes(pallet)) return "dispenser";
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
export { LOCATION_SITES as a, bayFor as c, siteLabel as d, slotId as f, LEVELS as i, isBarn as l, BARN_EQUIP_CAPACITY as n, SITE_LABEL as o, FRONT_PALLETS as r, SITE_PURPOSE as s, BACK_PALLETS as t, palletsFor as u };
