import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { n as cn } from "./button-6ZsGYj3J.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/sort-C5YlOVRH.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function SelectField({ className, children, allowEmpty, emptyLabel = "—", ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
		className: cn("h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className),
		...props,
		children: [allowEmpty ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
			value: "",
			children: emptyLabel
		}) : null, children]
	});
}
function SortSelect({ value, onChange, options, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: cn("flex min-w-0 items-center gap-2", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "shrink-0 text-xs font-medium tracking-wide text-muted-foreground uppercase",
			children: "Sort"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
			"aria-label": "Sort this list",
			value,
			onChange: (e) => onChange(e.target.value),
			className: "h-9 min-w-0 flex-1 sm:w-56 sm:flex-none",
			children: options.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
				value: o.id,
				children: o.label
			}, o.id))
		})]
	});
}
function useDeskSort(pageKey, fallback) {
	const storageKey = `katz-sort-${pageKey}`;
	const [sort, setSort] = (0, import_react.useState)(fallback);
	const [hydrated, setHydrated] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		try {
			const saved = window.localStorage.getItem(storageKey);
			if (saved) setSort(saved);
		} catch {}
		setHydrated(true);
	}, [storageKey]);
	(0, import_react.useEffect)(() => {
		if (!hydrated) return;
		try {
			window.localStorage.setItem(storageKey, sort);
		} catch {}
	}, [
		storageKey,
		sort,
		hydrated
	]);
	return [sort, setSort];
}
var SORT_DATE = [{
	id: "date-desc",
	label: "Date · Latest → Oldest"
}, {
	id: "date-asc",
	label: "Date · Oldest → Latest"
}];
var SORT_ALPHA = [{
	id: "alpha-asc",
	label: "Name · A → Z"
}, {
	id: "alpha-desc",
	label: "Name · Z → A"
}];
var SORT_EQUIP = [{
	id: "equip-desc",
	label: "Equipment · Most → Least"
}, {
	id: "equip-asc",
	label: "Equipment · Least → Most"
}];
var SORT_VALUE = [{
	id: "value-desc",
	label: "Deal value · Highest → Lowest"
}, {
	id: "value-asc",
	label: "Deal value · Lowest → Highest"
}];
var SORT_STATUS = [{
	id: "status",
	label: "Status"
}];
var SORT_FLAG = [{
	id: "flag",
	label: "Urgency · Flags first"
}];
var SORT_TECH = [{
	id: "tech",
	label: "Technician"
}];
var SORT_LIST = [
	...SORT_DATE,
	...SORT_ALPHA,
	...SORT_EQUIP,
	...SORT_STATUS,
	...SORT_FLAG,
	...SORT_TECH
];
var SORT_DEALS = [
	...SORT_DATE,
	...SORT_ALPHA,
	...SORT_EQUIP,
	...SORT_VALUE,
	...SORT_STATUS
];
function equipmentCount(raw, extra = 0) {
	if (extra > 0) return extra;
	if (!raw?.trim()) return 0;
	const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
	if (lines.length > 1) return lines.length;
	const bits = lines[0].split(/\s*(?:,|&|\+|\/)\s*/).map((s) => s.trim()).filter(Boolean);
	return Math.max(bits.length, 1);
}
function str(v) {
	return (v ?? "").trim().toLowerCase();
}
function compareEquip(a, b, desc) {
	if (typeof a === "string" || typeof b === "string") {
		const n = str(typeof a === "string" ? a : "").localeCompare(str(typeof b === "string" ? b : ""));
		return desc ? -n : n;
	}
	const na = typeof a === "number" ? a : 0;
	const nb = typeof b === "number" ? b : 0;
	return desc ? nb - na : na - nb;
}
function compareDesk(a, b, sort, get) {
	const dateA = str(get.date?.(a));
	const dateB = str(get.date?.(b));
	const nameA = str(get.name?.(a));
	const nameB = str(get.name?.(b));
	const eqRawA = get.equipment?.(a);
	const eqRawB = get.equipment?.(b);
	const nameASafe = nameA;
	const nameBSafe = nameB;
	const valA = get.value?.(a) ?? 0;
	const valB = get.value?.(b) ?? 0;
	const stA = str(get.status?.(a));
	const stB = str(get.status?.(b));
	const flA = get.flagRank?.(a) ?? 99;
	const flB = get.flagRank?.(b) ?? 99;
	const techA = str(get.tech?.(a));
	const techB = str(get.tech?.(b));
	let n = 0;
	switch (sort) {
		case "date-desc":
			n = (dateB || "0000").localeCompare(dateA || "0000") || nameASafe.localeCompare(nameBSafe);
			break;
		case "date-asc":
			n = (dateA || "9999").localeCompare(dateB || "9999") || nameASafe.localeCompare(nameBSafe);
			break;
		case "alpha-asc":
			n = nameASafe.localeCompare(nameBSafe);
			break;
		case "alpha-desc":
			n = nameBSafe.localeCompare(nameASafe);
			break;
		case "equip-desc":
			n = compareEquip(eqRawA, eqRawB, true) || nameASafe.localeCompare(nameBSafe);
			break;
		case "equip-asc":
			n = compareEquip(eqRawA, eqRawB, false) || nameASafe.localeCompare(nameBSafe);
			break;
		case "value-desc":
			n = valB - valA || nameASafe.localeCompare(nameBSafe);
			break;
		case "value-asc":
			n = valA - valB || nameASafe.localeCompare(nameBSafe);
			break;
		case "status":
			n = stA.localeCompare(stB) || nameASafe.localeCompare(nameBSafe);
			break;
		case "flag":
			n = flA - flB || dateA.localeCompare(dateB) || nameA.localeCompare(nameB);
			break;
		case "tech":
			n = techA.localeCompare(techB) || nameA.localeCompare(nameB);
			break;
		default: n = nameA.localeCompare(nameB);
	}
	return n;
}
function sortDesk(rows, sort, get) {
	return [...rows].sort((a, b) => compareDesk(a, b, sort, get));
}
function tally(rows, key) {
	const map = /* @__PURE__ */ new Map();
	for (const row of rows) {
		const name = (key(row) ?? "").trim() || "Unspecified";
		map.set(name, (map.get(name) ?? 0) + 1);
	}
	return [...map.entries()].map(([name, count]) => ({
		name,
		count
	})).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
//#endregion
export { SORT_FLAG as a, SORT_TECH as c, equipmentCount as d, sortDesk as f, SORT_EQUIP as i, SelectField as l, useDeskSort as m, SORT_DATE as n, SORT_LIST as o, tally as p, SORT_DEALS as r, SORT_STATUS as s, SORT_ALPHA as t, SortSelect as u };
