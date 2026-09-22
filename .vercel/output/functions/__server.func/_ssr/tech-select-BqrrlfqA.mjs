import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { m as TECHNICIANS } from "./lookups-BkjR5sto.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { t as SelectField } from "./select-field-BxGIjVBi.mjs";
import { c as techLabel, r as listTechs } from "./roster-CEJORJjG.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/tech-select-BqrrlfqA.js
var import_jsx_runtime = require_jsx_runtime();
function useRoster() {
	return useQuery({
		queryKey: ["roster"],
		queryFn: () => listTechs(),
		staleTime: 3e4
	});
}
function activeTechNames(techs) {
	if (techs?.length) return techs.filter((t) => t.active).map((t) => t.name);
	return [...TECHNICIANS];
}
function TechName({ name }) {
	const roster = useRoster();
	if (!name) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: "—" });
	if (activeTechNames(roster.data?.techs).some((n) => n.toLowerCase() === name.toLowerCase())) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: name });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		name,
		" ",
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-xs text-muted-foreground",
			children: "(inactive)"
		})
	] });
}
function TechSelect({ name, defaultValue, value, onChange, allowEmpty = true, className, id }) {
	const active = activeTechNames(useRoster().data?.techs ?? []);
	const current = (value ?? defaultValue ?? "") || "";
	const extras = current && !active.some((n) => n.toLowerCase() === current.toLowerCase()) ? [current] : [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
		id,
		name,
		className: className ?? "mt-1",
		defaultValue: value == null ? current : void 0,
		value,
		onChange,
		allowEmpty,
		emptyLabel: "—",
		children: [extras.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
			value: n,
			children: techLabel(n, new Set(active))
		}, `inactive-${n}`)), active.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
			value: n,
			children: n
		}, n))]
	});
}
function TechFilter({ value, onChange, extraNames, className }) {
	const active = activeTechNames(useRoster().data?.techs ?? []);
	const seen = new Set(active.map((n) => n.toLowerCase()));
	const leftover = [];
	for (const raw of extraNames ?? []) {
		const n = (raw ?? "").trim();
		if (!n || seen.has(n.toLowerCase())) continue;
		seen.add(n.toLowerCase());
		leftover.push(n);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
		value,
		onChange: (e) => onChange(e.target.value),
		allowEmpty: true,
		emptyLabel: "All techs",
		className: className ?? "w-40 min-w-0",
		"aria-label": "Filter by technician",
		children: [active.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
			value: n,
			children: n
		}, n)), leftover.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
			value: n,
			children: [n, " (inactive)"]
		}, `in-${n}`))]
	});
}
//#endregion
export { TechName as n, TechSelect as r, TechFilter as t };
