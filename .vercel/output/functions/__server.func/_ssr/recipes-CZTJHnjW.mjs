import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { b as Plus } from "../_libs/lucide-react.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { _ as cn, a as Route$5 } from "./router-1NWxggZt.mjs";
import { D as listDirectory, M as listRecipes, T as listCustomers, Y as upsertRecipe, l as copyRecipe } from "./api-CgwyWugK.mjs";
import { d as sortDesk, i as SORT_EQUIP, l as SortSelect, n as SORT_DATE, p as useDeskSort, t as SORT_ALPHA } from "./sort-1yS_DCzE.mjs";
import { n as Button, r as Input } from "./input-COYCsX_T.mjs";
import { t as catalogModels } from "./equipment-BifqoJpR.mjs";
import { t as RecipeForm } from "./recipe-form-BLdODl00.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/recipes-CZTJHnjW.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Page() {
	const { open } = Route$5.useSearch();
	const qc = useQueryClient();
	const recs = useQuery({
		queryKey: ["recipes"],
		queryFn: () => listRecipes()
	});
	const directoryEquip = useQuery({
		queryKey: ["directory", "equipment"],
		queryFn: () => listDirectory({ data: { kind: "equipment" } })
	});
	const customers = useQuery({
		queryKey: ["customers"],
		queryFn: () => listCustomers()
	});
	const [selected, setSelected] = (0, import_react.useState)(open ?? null);
	(0, import_react.useEffect)(() => {
		if (open != null) setSelected(open);
	}, [open]);
	const [filter, setFilter] = (0, import_react.useState)("");
	const [sort, setSort] = useDeskSort("recipes", "alpha-asc");
	const rows = recs.data ?? [];
	const needle = filter.trim().toLowerCase();
	const shown = (0, import_react.useMemo)(() => {
		const list = needle ? rows.filter((r) => [
			r.equipmentModel,
			r.customer ?? "house",
			r.notes ?? ""
		].some((v) => v.toLowerCase().includes(needle))) : rows;
		return sortDesk(list, sort, {
			date: (r) => r.updatedAt,
			name: (r) => r.customer ?? r.equipmentModel,
			equipment: (r) => r.equipmentModel
		});
	}, [
		rows,
		needle,
		sort
	]);
	const current = typeof selected === "number" ? rows.find((r) => r.id === selected) ?? null : null;
	const models = (0, import_react.useMemo)(() => catalogModels([...(directoryEquip.data ?? []).map((e) => e.name), ...rows.map((r) => r.equipmentModel)]), [directoryEquip.data, rows]);
	const grouped = (0, import_react.useMemo)(() => groupRecipes(shown), [shown]);
	const save = useMutation({
		mutationFn: (d) => upsertRecipe({ data: d }),
		onSuccess: (row) => {
			toast.success(row.customer ? `Saved for ${row.customer}` : "House recipe saved");
			qc.invalidateQueries({ queryKey: ["recipes"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
			setSelected(row.id);
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Failed")
	});
	const copy = useMutation({
		mutationFn: (d) => copyRecipe({ data: d }),
		onSuccess: (row) => {
			toast.success(`Copied onto ${row.customer}`);
			qc.invalidateQueries({ queryKey: ["recipes"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
			setSelected(row.id);
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Failed")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
		className: "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "font-display text-3xl font-medium tracking-tight",
			children: "Recipes"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 max-w-xl text-sm text-muted-foreground",
			children: "Settings live on a customer + machine. House templates can be edited and assigned to a customer. Fields start blank — nothing is filled in automatically."
		})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			onClick: () => setSelected("new"),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "New recipe"]
		})]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-6 grid gap-6 lg:grid-cols-[20rem_1fr]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: cn("rounded-xl border border-border bg-card", selected != null && "hidden lg:block"),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-b border-border p-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: filter,
					onChange: (e) => setFilter(e.target.value),
					placeholder: "Filter customers or models…"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
						value: sort,
						onChange: setSort,
						options: [
							...SORT_ALPHA,
							...SORT_DATE,
							...SORT_EQUIP
						],
						className: "w-full max-w-none sm:w-full"
					})
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "max-h-[60vh] overflow-y-auto",
				children: [
					grouped.house.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "px-4 pt-3 pb-1 text-[11px] tracking-wide text-muted-foreground uppercase",
						children: "House templates"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: grouped.house.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecipeNavItem, {
						recipe: r,
						active: current?.id === r.id,
						onClick: () => setSelected(r.id)
					}, r.id)) })] }) : null,
					grouped.customers.map(([name, list]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "px-4 pt-3 pb-1 text-[11px] tracking-wide text-muted-foreground uppercase",
						children: name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: list.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecipeNavItem, {
						recipe: r,
						active: current?.id === r.id,
						onClick: () => setSelected(r.id),
						hideCustomer: true
					}, r.id)) })] }, name)),
					shown.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "px-4 py-6 text-sm text-muted-foreground",
						children: "No recipes yet."
					}) : null
				]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: cn("rounded-xl border border-border bg-card p-5", selected == null && "hidden lg:block"),
			children: [selected != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "mb-4 text-sm text-muted-foreground hover:text-foreground lg:hidden",
				onClick: () => setSelected(null),
				children: "← All recipes"
			}) : null, selected == null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: "Select a customer recipe, a house template, or add a new one. New cards start empty — pick the fields you need. House templates can be edited and assigned to a customer from here."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecipeForm, {
				draft: {
					recipe: current,
					customer: current?.customer ?? null,
					equipmentModel: current?.equipmentModel ?? "",
					installId: current?.installId ?? null,
					copiedFrom: current?.copiedFrom ?? null
				},
				models,
				customers: customers.data ?? [],
				pending: save.isPending,
				copyPending: copy.isPending,
				onSave: (d) => save.mutate(d),
				onCopy: (d) => copy.mutate(d)
			}, current?.id ?? "new")]
		})]
	})] });
}
function RecipeNavItem({ recipe: r, active, onClick, hideCustomer }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick,
		className: cn("w-full px-4 py-2.5 text-left text-sm hover:bg-muted/60", active && "bg-muted"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "block font-medium",
			children: r.equipmentModel
		}), hideCustomer ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "block text-xs text-muted-foreground",
			children: r.customer ?? "Shared house recipe"
		})]
	}) });
}
function groupRecipes(rows) {
	const house = rows.filter((r) => !r.customer);
	const byCust = /* @__PURE__ */ new Map();
	for (const r of rows) {
		if (!r.customer) continue;
		const list = byCust.get(r.customer) ?? [];
		list.push(r);
		byCust.set(r.customer, list);
	}
	return {
		house,
		customers: [...byCust.entries()].sort((a, b) => a[0].localeCompare(b[0]))
	};
}
//#endregion
export { Page as component };
