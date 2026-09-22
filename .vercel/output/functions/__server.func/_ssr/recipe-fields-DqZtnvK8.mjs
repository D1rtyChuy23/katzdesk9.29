//#region node_modules/.nitro/vite/services/ssr/assets/recipe-fields-DqZtnvK8.js
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
//#endregion
export { settingsFrom as a, previewSetting as i, SETTING_FIELDS as n, filledSettingNames as r, DEFAULT_SETTING_NAMES as t };
