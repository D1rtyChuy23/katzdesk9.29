import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { l as Plus } from "../_libs/lucide-react.mjs";
import { i as useQueryClient, n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { c as Route$7, f as useOpenRecord } from "./router-BpVsA2Dc.mjs";
import { t as Button } from "./button-6ZsGYj3J.mjs";
import { E as listModules, p as createModule } from "./api-B23zb1CT.mjs";
import { c as MODULE_TYPES } from "./lookups-sAI9gyB5.mjs";
import { c as SORT_TECH, d as equipmentCount, f as sortDesk, i as SORT_EQUIP, m as useDeskSort, n as SORT_DATE, p as tally, s as SORT_STATUS, t as SORT_ALPHA, u as SortSelect } from "./sort-C5YlOVRH.mjs";
import { t as Input } from "./input-D-eo25vp.mjs";
import { a as SimpleBars, c as StatusBadge, l as StatusDonut, s as StatCard, t as ChartCard } from "./desk-charts-BV1SUC0s.mjs";
import { c as SimpleCreateDialog, i as ModuleSheet } from "./entity-sheets-Cr2nNM9k.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/modules-DBURsITh.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Page() {
	const { open } = Route$7.useSearch();
	const qc = useQueryClient();
	const data = useQuery({
		queryKey: ["modules"],
		queryFn: () => listModules()
	});
	const [q, setQ] = (0, import_react.useState)("");
	const [selected, setSelected] = useOpenRecord(open);
	const [create, setCreate] = (0, import_react.useState)(false);
	const [sort, setSort] = useDeskSort("modules", "status");
	const all = data.data ?? [];
	const readyRows = all.filter((m) => m.status === "Ready");
	const notReady = all.filter((m) => m.status !== "Ready" && m.status !== "Installed at Account" && m.status !== "Retired / Scrapped");
	const readyByTypeAll = MODULE_TYPES.map((type) => ({
		name: type,
		count: readyRows.filter((m) => m.moduleType === type).length
	}));
	const extraTypes = tally(readyRows, (m) => m.moduleType).filter((r) => !MODULE_TYPES.includes(r.name));
	const readyByTypeChart = [...readyByTypeAll, ...extraTypes];
	const readyByType = readyByTypeChart.filter((r) => r.count > 0);
	const readyByPlatform = tally(readyRows, (m) => m.platform);
	const statusMix = tally(all, (m) => m.status);
	const rows = (0, import_react.useMemo)(() => {
		const needle = q.trim().toLowerCase();
		let list = all;
		if (needle) list = list.filter((m) => [
			m.moduleId,
			m.location,
			m.moduleType,
			m.status,
			m.wo
		].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle)));
		return sortDesk(list, sort, {
			date: (m) => m.dateReady ?? m.dateIn ?? m.updatedAt,
			name: (m) => m.moduleId,
			equipment: (m) => equipmentCount(m.moduleType),
			status: (m) => m.status,
			tech: (m) => m.technician
		});
	}, [
		all,
		q,
		sort
	]);
	const selectedRow = all.find((m) => m.id === selected) ?? null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-medium tracking-tight",
				children: "Eversys modules"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-muted-foreground",
				children: "One row per physical module. The Ready count splits by type so you can see what can actually ship."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				onClick: () => setCreate(true),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "New module"]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 grid gap-3 md:grid-cols-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Tracked",
					value: all.length,
					hint: "Every module on the board"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Ready",
					value: readyRows.length,
					hint: readyByPlatform.map((p) => `${p.count} ${p.name}`).join(" · ") || "Nothing ready",
					breakdown: readyByType
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "In shop",
					value: notReady.length,
					hint: "Not ready, not installed, not retired"
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-5 grid gap-4 lg:grid-cols-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
				title: "By status",
				lede: "Where the shop floor actually sits.",
				children: statusMix.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDonut, {
					data: statusMix,
					unit: "modules"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "No modules yet."
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
				title: "Ready by type",
				lede: "The Ready bubble, unpacked.",
				children: readyRows.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleBars, {
					data: readyByTypeChart.map((r) => ({
						type: r.name.replace(" Module", ""),
						count: r.count
					})),
					xKey: "type",
					yKey: "count",
					yLabel: "Ready",
					horizontal: true
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "Nothing marked Ready."
				})
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 flex flex-wrap items-center gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				value: q,
				onChange: (e) => setQ(e.target.value),
				placeholder: "Filter modules…",
				className: "max-w-xs"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
				value: sort,
				onChange: setSort,
				options: [
					...SORT_STATUS,
					...SORT_ALPHA,
					...SORT_DATE,
					...SORT_EQUIP,
					...SORT_TECH
				]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-3 overflow-hidden rounded-xl border border-border bg-card",
			children: [rows.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setSelected(m.id),
				className: "grid w-full gap-1 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60 md:grid-cols-[8rem_1fr_8rem_8rem] md:items-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-xs",
						children: m.moduleId
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-medium",
						children: m.moduleType
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "mt-0.5 block text-xs text-muted-foreground",
						children: [
							m.platform,
							" · ",
							m.location ?? "—"
						]
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: m.status }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-sm text-muted-foreground",
						children: m.technician ?? "—"
					})
				]
			}, m.id)), rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-4 py-8 text-sm text-muted-foreground",
				children: "No modules in this view."
			}) : null]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModuleSheet, {
			row: selectedRow,
			onClose: () => setSelected(null)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleCreateDialog, {
			title: "New module",
			open: create,
			onOpenChange: setCreate,
			fields: [{
				name: "moduleId",
				label: "Module ID",
				required: true
			}],
			onSubmit: async (v) => {
				const row = await createModule({ data: { moduleId: v.moduleId } });
				qc.invalidateQueries({ queryKey: ["modules"] });
				toast.success("Module added");
				setSelected(row.id);
			}
		})
	] });
}
//#endregion
export { Page as component };
