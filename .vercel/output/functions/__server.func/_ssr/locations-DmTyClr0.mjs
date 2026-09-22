import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { b as Plus } from "../_libs/lucide-react.mjs";
import { i as useQueryClient, n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { _ as cn, d as Route$12, x as useOpenRecord } from "./router-1NWxggZt.mjs";
import { S as listAssets, u as createAsset } from "./api-CgwyWugK.mjs";
import { t as SelectField } from "./select-field-BxGIjVBi.mjs";
import { d as sortDesk, i as SORT_EQUIP, l as SortSelect, n as SORT_DATE, p as useDeskSort, s as SORT_STATUS, t as SORT_ALPHA } from "./sort-1yS_DCzE.mjs";
import { r as StatusBadge } from "./flag-badge-jup2uYzS.mjs";
import { i as Label, n as Button, r as Input } from "./input-COYCsX_T.mjs";
import { i as SimpleBars, o as StatCard, t as ChartCard } from "./desk-charts-BMK8dv-e.mjs";
import { i as DialogTitle, n as DialogContent, t as Dialog } from "./dialog-zUw3eso-.mjs";
import { a as LOCATION_SITES, o as SITE_LABEL, s as SITE_PURPOSE } from "./warehouse-B30B9_go.mjs";
import { t as AssetSheet } from "./asset-sheet-CsrOKB8S.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/locations-DmTyClr0.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Page() {
	const { open } = Route$12.useSearch();
	const qc = useQueryClient();
	const data = useQuery({
		queryKey: ["assets"],
		queryFn: () => listAssets()
	});
	const [tab, setTab] = (0, import_react.useState)("deployed");
	const [q, setQ] = (0, import_react.useState)("");
	const [selected, setSelected] = useOpenRecord(open);
	const [create, setCreate] = (0, import_react.useState)(false);
	const [sort, setSort] = useDeskSort("locations", "alpha-asc");
	const all = data.data ?? [];
	const needle = q.trim().toLowerCase();
	const groups = (0, import_react.useMemo)(() => {
		const match = (a) => {
			if (!needle) return true;
			return [
				a.model,
				a.serial,
				a.purpose,
				a.soldTo,
				SITE_LABEL[a.site]
			].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle));
		};
		const sortRows = (rows) => sortDesk(rows, sort, {
			name: (a) => a.model,
			equipment: (a) => a.qty ?? 1,
			status: (a) => a.status,
			date: (a) => a.soldAt ?? a.updatedAt
		});
		if (tab === "sold") return [{
			site: "sold",
			rows: sortRows(all.filter((a) => a.status === "sold" && match(a)))
		}];
		if (tab === "field") return [{
			site: "field",
			rows: sortRows(all.filter((a) => a.status === "assigned" && match(a)))
		}];
		return LOCATION_SITES.map((site) => ({
			site,
			rows: sortRows(all.filter((a) => a.site === site && a.status === "deployed" && match(a)))
		}));
	}, [
		all,
		tab,
		needle,
		sort
	]);
	const selectedRow = all.find((a) => a.id === selected) ?? null;
	const deployedCount = all.filter((a) => a.status === "deployed").length;
	const fieldCount = all.filter((a) => a.status === "assigned").length;
	const soldCount = all.filter((a) => a.status === "sold").length;
	const bySite = LOCATION_SITES.map((site) => ({
		name: SITE_LABEL[site] ?? site,
		count: all.filter((a) => a.status === "deployed" && a.site === site).length
	}));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-medium tracking-tight",
				children: "Equipment by location"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-muted-foreground",
				children: "Units not on the barn racks — lobby, service room, training, SATX, and anything currently pulled for an install or a service call. Return a unit to free the slot for the next job."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				onClick: () => setCreate(true),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "Log at a location"]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 grid min-w-0 grid-cols-3 gap-2 sm:gap-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "On site",
					value: deployedCount
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "On an install",
					value: fieldCount
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Sold",
					value: soldCount
				})
			]
		}),
		bySite.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
			className: "mt-5",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartCard, {
				title: "Deployed by location",
				lede: "Units sitting at HQ rooms and SATX — not the barn racks.",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimpleBars, {
					data: bySite.map((s) => ({
						site: s.name,
						count: s.count
					})),
					xKey: "site",
					yKey: "count",
					yLabel: "Units",
					horizontal: true
				})
			})
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 flex flex-wrap gap-2",
			children: [
				[
					["deployed", `On site (${deployedCount})`],
					["field", `Pulled (${fieldCount})`],
					["sold", `Sold (${soldCount})`]
				].map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setTab(id),
					className: cn("h-9 rounded-full px-3 text-sm font-medium", tab === id ? "bg-ink text-ink-foreground" : "bg-secondary"),
					children: label
				}, id)),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Filter…",
					className: "max-w-xs"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
					value: sort,
					onChange: setSort,
					options: [
						...SORT_ALPHA,
						...SORT_DATE,
						...SORT_EQUIP,
						...SORT_STATUS
					]
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-5 space-y-6",
			children: groups.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-2 flex items-baseline justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-xl",
					children: SITE_LABEL[g.site] ?? g.site
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-muted-foreground",
					children: [g.rows.reduce((n, a) => n + a.qty, 0), " units"]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "overflow-hidden rounded-xl border border-border bg-card",
				children: [g.rows.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => setSelected(a.id),
					className: "grid w-full gap-1 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60 md:grid-cols-[1.4fr_1fr_8rem] md:items-center",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium",
							children: a.model
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "mt-0.5 block text-xs text-muted-foreground",
							children: [a.serial ?? "No serial", a.qty > 1 ? ` · qty ${a.qty}` : ""]
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-sm text-muted-foreground",
							children: [a.purpose ?? a.soldTo ?? "—", a.soldAt ? ` · ${a.soldAt}` : ""]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: a.status === "sold" ? "Sold" : a.status === "assigned" ? a.installId ? "On an install" : "On service" : "In use" })
					]
				}, a.id)), g.rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "px-4 py-6 text-sm text-muted-foreground",
					children: "Nothing logged here."
				}) : null]
			})] }, g.site))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AssetSheet, {
			asset: selectedRow,
			onClose: () => setSelected(null)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
			open: create,
			onOpenChange: setCreate,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Log equipment at a location" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-4 space-y-3",
				onSubmit: async (e) => {
					e.preventDefault();
					const fd = new FormData(e.currentTarget);
					try {
						const row = await createAsset({ data: {
							model: String(fd.get("model")),
							serial: String(fd.get("serial") || "") || null,
							site: String(fd.get("site")),
							purpose: String(fd.get("purpose") || "") || SITE_PURPOSE[String(fd.get("site"))] || null
						} });
						qc.invalidateQueries({ queryKey: ["assets"] });
						toast.success("Logged");
						setCreate(false);
						setSelected(row.id);
					} catch (err) {
						toast.error(err instanceof Error ? err.message : "Failed");
					}
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Location" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "site",
						className: "mt-1",
						defaultValue: "front-lobby",
						children: LOCATION_SITES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: s,
							children: SITE_LABEL[s]
						}, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Model" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						name: "model",
						className: "mt-1",
						required: true
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Serial" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						name: "serial",
						className: "mt-1"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Purpose" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						name: "purpose",
						className: "mt-1",
						placeholder: "Showroom, training, loaner…"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex justify-end",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							children: "Add"
						})
					})
				]
			})] })
		})
	] });
}
//#endregion
export { Page as component };
