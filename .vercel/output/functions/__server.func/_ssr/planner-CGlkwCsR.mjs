import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { g as useMyView, h as MyViewBar } from "./router-1NWxggZt.mjs";
import { M as listRecipes, O as listInstalls } from "./api-CgwyWugK.mjs";
import { t as Skeleton } from "./separator-AdNvdRLl.mjs";
import { t as catalogModels } from "./equipment-BifqoJpR.mjs";
import { t as InstallPlanner } from "./install-planner-7gySm_ON.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/planner-CGlkwCsR.js
var import_jsx_runtime = require_jsx_runtime();
function Page() {
	const { matchMine, filterMine, role } = useMyView();
	const data = useQuery({
		queryKey: ["installs"],
		queryFn: () => listInstalls()
	});
	const recs = useQuery({
		queryKey: ["recipes"],
		queryFn: () => listRecipes()
	});
	const mineRep = filterMine && role === "sales" ? (data.data ?? []).find((i) => matchMine(i.accountRep))?.accountRep ?? null : null;
	const rows = data.data ?? [];
	const catalog = catalogModels(rows.map((i) => i.equipment ?? ""));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
		className: "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "font-display text-3xl font-medium tracking-tight",
			children: "Install planner"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 max-w-xl text-sm text-muted-foreground",
			children: "Timeline for every open install. Same records as the Install board — a date change here is the install date on the export."
		})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MyViewBar, {})]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mt-5",
		children: data.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-64 w-full" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InstallPlanner, {
			installs: rows,
			recipes: recs.data ?? [],
			catalog,
			myRep: mineRep
		})
	})] });
}
//#endregion
export { Page as component };
