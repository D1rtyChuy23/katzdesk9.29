//#region node_modules/.nitro/vite/services/ssr/assets/recipe-fields-Du4_qzKD.js
var SETTING_FIELDS = [
	{
		name: "coffee1",
		label: "Coffee 1"
	},
	{
		name: "coffee2",
		label: "Coffee 2"
	},
	{
		name: "coffee3",
		label: "Coffee 3"
	},
	{
		name: "powder1",
		label: "Powder 1"
	},
	{
		name: "powder2",
		label: "Powder 2"
	},
	{
		name: "powder3",
		label: "Powder 3"
	},
	{
		name: "americano1",
		label: "Americano 1"
	},
	{
		name: "americano2",
		label: "Americano 2"
	},
	{
		name: "americano3",
		label: "Americano 3"
	},
	{
		name: "tea1",
		label: "Tea 1"
	},
	{
		name: "tea2",
		label: "Tea 2"
	},
	{
		name: "milk",
		label: "Milk settings"
	}
];
/** New recipes start with the first listing in each category. */
var DEFAULT_SETTING_NAMES = [
	"coffee1",
	"powder1",
	"americano1",
	"tea1",
	"milk"
];
var EMPTY_SETTINGS = {
	coffee1: null,
	coffee2: null,
	coffee3: null,
	powder1: null,
	powder2: null,
	powder3: null,
	americano1: null,
	americano2: null,
	americano3: null,
	tea1: null,
	tea2: null,
	milk: null
};
function settingsFrom(row) {
	const next = { ...EMPTY_SETTINGS };
	if (!row) return next;
	for (const f of SETTING_FIELDS) {
		const v = row[f.name];
		next[f.name] = typeof v === "string" && v.trim() ? v : null;
	}
	return next;
}
function filledSettingNames(row) {
	if (!row) return [...DEFAULT_SETTING_NAMES];
	const filled = SETTING_FIELDS.filter((f) => (row[f.name] ?? "").trim()).map((f) => f.name);
	return filled.length ? filled : [...DEFAULT_SETTING_NAMES];
}
function previewSetting(row) {
	if (!row) return null;
	for (const f of SETTING_FIELDS) {
		const v = (row[f.name] ?? "").trim();
		if (v) return v.split("\n")[0].slice(0, 72);
	}
	return null;
}
/** Rough machine type from the model name, used to pick sensible starting settings. */
function equipKind(model) {
	const m = model.toLowerCase();
	if (/grinder|mahl|mazzer|ditting|\bek ?43\b|\bg9|\bg3\b|\bmdxs?\b|\bsuper jolly/.test(m)) return "grinder";
	if (/powder|imix|i-mix|cappuccino|cappu|frappe|hot choc/.test(m)) return "powder";
	if (/eversys|cameo|e'?4|e'?2|la marzocco|linea|strada|gb5|nuova simonelli|appia|aurelia|faema|e61|franke|schaerer|thermoplan|jura|legacy|kb90/.test(m)) return "espresso";
	if (/bunn|fetco|itcb|tb3|axiom|cbs|brewer|urn|dispenser|curtis/.test(m)) return "brewer";
	return "other";
}
/** Standard settings a new recipe starts with, by machine type. */
function defaultSettingsFor(model) {
	switch (equipKind(model)) {
		case "grinder": return [];
		case "espresso": return [
			"coffee1",
			"americano1",
			"milk"
		];
		case "brewer": return ["coffee1", "tea1"];
		case "powder": return ["powder1", "powder2"];
		default: return ["coffee1"];
	}
}
/** Custom settings a new recipe starts with, by machine type (saved into notes as "Label: value"). */
function defaultCustomFor(model) {
	return equipKind(model) === "grinder" ? ["Grind setting", "Dose"] : [];
}
/** Common extras offered in "+ Add setting", beyond the standard recipe fields. */
var CUSTOM_SUGGESTIONS = [
	"Grind setting",
	"Dose",
	"Yield",
	"Shot time",
	"Water temp",
	"Brew volume",
	"Batch size",
	"Bypass",
	"Pre-infusion",
	"Steam pressure"
];
//#endregion
export { defaultSettingsFor as a, settingsFrom as c, defaultCustomFor as i, DEFAULT_SETTING_NAMES as n, filledSettingNames as o, SETTING_FIELDS as r, previewSetting as s, CUSTOM_SUGGESTIONS as t };
