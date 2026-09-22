import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { a as formatRep, o as isNoRep } from "./rep-match-DCVeb4ID.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { _ as cn } from "./router-1NWxggZt.mjs";
import { t as SelectField } from "./select-field-BxGIjVBi.mjs";
import { i as Label } from "./input-COYCsX_T.mjs";
import { n as NoRepFlag } from "./ak-badge-m29_U4_Z.mjs";
import { i as listReps } from "./reps-B2EuoM-m.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/rep-select-BQ75vNDf.js
var import_jsx_runtime = require_jsx_runtime();
function useReps() {
	return useQuery({
		queryKey: ["reps"],
		queryFn: () => listReps()
	});
}
function activeReps(reps, current) {
	const list = reps ?? [];
	const active = list.filter((r) => r.active);
	const cur = (current ?? "").trim();
	if (cur && !active.some((r) => r.name === cur) && !list.some((r) => r.name === cur && r.active)) {
		const leftover = list.find((r) => r.name === cur);
		if (leftover) return [...active, leftover];
	}
	return active;
}
function RepSelect({ name = "producer", value, defaultValue, onChange, label = "Rep", id, className }) {
	const q = useReps();
	const current = value ?? defaultValue ?? "";
	const reps = activeReps(q.data?.reps, current);
	const unknown = !!current && isNoRep(current);
	const selected = unknown ? current : current;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className,
		children: [
			label ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
				htmlFor: id,
				children: label
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
				id,
				name,
				className: label ? "mt-1" : void 0,
				value,
				defaultValue: value == null ? defaultValue ?? "" : void 0,
				onChange: onChange ? (e) => onChange(e.target.value) : void 0,
				allowEmpty: true,
				emptyLabel: "—",
				children: [unknown ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
					value: current,
					children: [current, " (unknown)"]
				}) : null, reps.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
					value: r.name,
					children: [
						r.name,
						" (",
						r.initials,
						")"
					]
				}, r.id))]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoRepFlag, {
				show: isNoRep(selected),
				className: "mt-1 block"
			})
		]
	});
}
function RepFilter({ value, onChange, extraNames, className, includeNone = true }) {
	const q = useReps();
	const names = /* @__PURE__ */ new Map();
	for (const r of q.data?.reps ?? []) if (r.active) names.set(r.name, `${r.name} (${r.initials})`);
	for (const n of extraNames ?? []) {
		const s = (n ?? "").trim();
		if (s && !names.has(s)) names.set(s, isNoRep(s) ? `${s} (unknown)` : formatRep(s));
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
		value,
		onChange: (e) => onChange(e.target.value),
		allowEmpty: true,
		emptyLabel: "All reps",
		className: cn("max-w-xs", className),
		"aria-label": "Filter by rep",
		children: [includeNone ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
			value: "__none__",
			children: "No rep assigned"
		}) : null, [...names.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
			value: name,
			children: label
		}, name))]
	});
}
function RepName({ name }) {
	if (!name?.trim()) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoRepFlag, { show: true });
	if (isNoRep(name)) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
		name,
		" ",
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoRepFlag, {
			show: true,
			className: "ml-1"
		})
	] });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: formatRep(name) });
}
//#endregion
export { RepName as n, RepSelect as r, RepFilter as t };
