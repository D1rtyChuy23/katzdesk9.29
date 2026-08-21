import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { i as listDeskAccounts, r as getMyAccess, s as setAccountApproved } from "./access-Cv44_4sH.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Button } from "./button-6ZsGYj3J.mjs";
import { f as sortDesk, m as useDeskSort, n as SORT_DATE, t as SORT_ALPHA, u as SortSelect } from "./sort-C5YlOVRH.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/access-CyC2ONmk.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Page() {
	const qc = useQueryClient();
	const me = useQuery({
		queryKey: ["access", "me"],
		queryFn: () => getMyAccess()
	});
	const list = useQuery({
		queryKey: ["access", "list"],
		queryFn: () => listDeskAccounts(),
		enabled: !!me.data?.isAdmin
	});
	const setApproved = useMutation({
		mutationFn: (d) => setAccountApproved({ data: d }),
		onSuccess: (row) => {
			toast.success(row.approved ? `Approved ${row.username}` : `Revoked ${row.username}`);
			qc.invalidateQueries({ queryKey: ["access"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Failed")
	});
	const [sort, setSort] = useDeskSort("access", "date-desc");
	const pending = (list.data ?? []).filter((a) => !a.approved);
	const active = (0, import_react.useMemo)(() => sortDesk(list.data ?? [], sort, {
		date: (a) => a.createdAt,
		name: (a) => a.username
	}).filter((a) => a.approved), [list.data, sort]);
	if (me.data && !me.data.isAdmin) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
		className: "font-display text-3xl font-medium tracking-tight",
		children: "Access"
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "mt-2 text-sm text-muted-foreground",
		children: "Only an admin can review new accounts."
	})] });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-medium tracking-tight",
				children: "Access"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-muted-foreground",
				children: "New username accounts wait here until you approve them. They cannot open the desk until then."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
					value: sort,
					onChange: setSort,
					options: [...SORT_DATE, ...SORT_ALPHA]
				})
			})
		] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: [
					"Waiting (",
					pending.length,
					")"
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "mt-2 overflow-hidden rounded-xl border border-border bg-card",
				children: [pending.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-medium",
							children: a.username
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "truncate text-sm text-muted-foreground",
							children: a.email ?? "No email"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						disabled: setApproved.isPending,
						onClick: () => setApproved.mutate({
							userId: a.userId,
							approved: true
						}),
						children: "Approve"
					})]
				}, a.userId)), pending.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "px-4 py-6 text-sm text-muted-foreground",
					children: "No one is waiting."
				}) : null]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: [
					"Approved (",
					active.length,
					")"
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-2 overflow-hidden rounded-xl border border-border bg-card",
				children: active.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "font-medium",
							children: [a.username, a.isAdmin ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ml-2 text-xs text-muted-foreground",
								children: "admin"
							}) : null]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "truncate text-sm text-muted-foreground",
							children: a.email ?? "No email"
						})]
					}), !a.isAdmin ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "outline",
						disabled: setApproved.isPending,
						onClick: () => setApproved.mutate({
							userId: a.userId,
							approved: false
						}),
						children: "Revoke"
					}) : null]
				}, a.userId))
			})]
		})
	] });
}
//#endregion
export { Page as component };
