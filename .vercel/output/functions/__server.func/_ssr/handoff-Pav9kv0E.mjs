import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { r as getMyAccess } from "./access-Cv44_4sH.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as useCurrentUser } from "./use-current-user-DZ7NZd4-.mjs";
import { t as Button } from "./button-6ZsGYj3J.mjs";
import { g as getHandoff, j as resolveComment, v as handoffDeal } from "./api-B23zb1CT.mjs";
import { t as OpenLink } from "./open-link-CwtVBSba.mjs";
import { y as namesMatchUser } from "./lookups-sAI9gyB5.mjs";
import { f as sortDesk, m as useDeskSort, n as SORT_DATE, t as SORT_ALPHA, u as SortSelect } from "./sort-C5YlOVRH.mjs";
import { n as PingButton, t as Badge } from "./ping-button-Bgio9qNk.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/handoff-Pav9kv0E.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Page() {
	const qc = useQueryClient();
	const user = useCurrentUser();
	const access = useQuery({
		queryKey: ["access", "me"],
		queryFn: () => getMyAccess()
	});
	const feed = useQuery({
		queryKey: ["handoff"],
		queryFn: () => getHandoff()
	});
	const [scope, setScope] = (0, import_react.useState)("mine");
	(0, import_react.useEffect)(() => {
		try {
			if (window.localStorage.getItem("katz-handoff-view") === "all") setScope("all");
		} catch {}
	}, []);
	const [sort, setSort] = useDeskSort("handoff", "date-desc");
	const resolve = useMutation({
		mutationFn: (id) => resolveComment({ data: {
			id,
			resolved: true
		} }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["handoff"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		}
	});
	const promote = useMutation({
		mutationFn: (dealId) => handoffDeal({ data: { dealId } }),
		onSuccess: () => {
			toast.success("Install row created");
			qc.invalidateQueries({ queryKey: ["handoff"] });
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		}
	});
	const d = feed.data;
	const filtered = (0, import_react.useMemo)(() => filterHandoff(d, user, access.data?.username ?? null, scope), [
		d,
		user,
		access.data?.username,
		scope
	]);
	const sortedAsks = (0, import_react.useMemo)(() => sortDesk(filtered.asks, sort, {
		date: (c) => c.createdAt,
		name: (c) => c.customer ?? c.authorName
	}), [filtered.asks, sort]);
	const sortedRecent = (0, import_react.useMemo)(() => sortDesk(filtered.recent, sort, {
		date: (c) => c.createdAt,
		name: (c) => c.customer ?? c.authorName
	}), [filtered.recent, sort]);
	const mineCount = (0, import_react.useMemo)(() => {
		const mine = filterHandoff(d, user, access.data?.username ?? null, "mine");
		const askIds = new Set(mine.asks.map((c) => c.id));
		return mine.pendingHandoffs.length + mine.asks.length + mine.recent.filter((c) => !askIds.has(c.id)).length;
	}, [
		d,
		user,
		access.data?.username
	]);
	function setView(next) {
		setScope(next);
		try {
			window.localStorage.setItem("katz-handoff-view", next);
		} catch {}
	}
	const emptyMine = scope === "mine" && !!d && !filtered.pendingHandoffs.length && !filtered.asks.length && !filtered.recent.length;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-medium tracking-tight",
				children: "Handoff"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-2xl text-sm text-muted-foreground",
				children: "The conversation between sales and service. Mine shows asks, notes, and completed deals that belong to you."
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-3 border-y border-border py-3 sm:flex-row sm:items-center sm:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex h-10 w-fit items-center rounded-full bg-secondary p-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setView("mine"),
						className: `h-8 rounded-full px-3.5 text-sm font-medium ${scope === "mine" ? "bg-ink text-ink-foreground" : "text-foreground hover:bg-background/70"}`,
						children: [
							"Mine (",
							mineCount,
							")"
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setView("all"),
						className: `h-8 rounded-full px-3.5 text-sm font-medium ${scope === "all" ? "bg-ink text-ink-foreground" : "text-foreground hover:bg-background/70"}`,
						children: "All"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortSelect, {
						value: sort,
						onChange: setSort,
						options: [...SORT_DATE, ...SORT_ALPHA]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PingButton, {
						contextLabel: "Check the handoff board",
						entityType: "handoff"
					})]
				})]
			}),
			feed.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: "Loading the desk…"
			}) : emptyMine ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-xl border border-border bg-card p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-medium",
					children: "Nothing of yours is waiting."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted-foreground",
					children: "Mine shows notes you wrote, jobs assigned to you, and deals you produced. Switch to All to see the rest of the desk."
				})]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [filtered.pendingHandoffs.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-xl border border-border bg-card p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-xl",
					children: "Completed deals not yet on the install board"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-3 divide-y divide-border",
					children: filtered.pendingHandoffs.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex flex-wrap items-center justify-between gap-3 py-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-medium",
							children: p.customer
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs text-muted-foreground",
							children: [
								p.producer ?? "—",
								" · ",
								p.equipment
							]
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PingButton, {
								size: "xs",
								entityType: "deal",
								entityId: p.dealId,
								contextLabel: `${p.customer} deal is complete but not on the install board`
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								onClick: () => promote.mutate(p.dealId),
								disabled: promote.isPending,
								children: "Send to installs"
							})]
						})]
					}, p.dealId))
				})]
			}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid gap-4 lg:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-border bg-card p-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-xl",
						children: "Open asks"
					}), !filtered.asks.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-sm text-muted-foreground",
						children: scope === "mine" ? "No open asks on your work." : "No unanswered asks. Nice."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-3 space-y-4",
						children: sortedAsks.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "rounded-lg border border-border bg-background p-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
										variant: "warn",
										children: ["Ask ", c.askTeam]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OpenLink, {
										entityType: c.entityType,
										id: c.entityId,
										className: "text-sm font-medium underline-offset-2 hover:underline",
										children: c.customer ?? c.entityType
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-sm leading-relaxed",
									children: c.body
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-2 flex flex-wrap items-center justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-muted-foreground",
										children: c.authorName
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PingButton, {
											size: "xs",
											entityType: c.entityType,
											entityId: c.entityId,
											contextLabel: `${c.customer ?? c.entityType} · ${c.body.slice(0, 80)}`
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: "text-xs text-muted-foreground underline-offset-2 hover:underline",
											onClick: () => resolve.mutate(c.id),
											children: "Mark answered"
										})]
									})]
								})
							]
						}, c.id))
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-border bg-card p-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-xl",
						children: "Recent notes"
					}), !filtered.recent.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-sm text-muted-foreground",
						children: scope === "mine" ? "No recent notes on your work." : "No notes yet."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-3 space-y-4",
						children: sortedRecent.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium",
									children: c.authorName
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-muted-foreground",
									children: [" · ", c.customer ?? c.entityType]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PingButton, {
								size: "xs",
								entityType: c.entityType,
								entityId: c.entityId,
								contextLabel: `${c.customer ?? c.entityType} · ${c.body.slice(0, 80)}`
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm leading-relaxed text-muted-foreground",
							children: c.body
						})] }, c.id))
					})]
				})]
			})] })
		]
	});
}
function filterHandoff(d, user, username, scope) {
	const empty = {
		asks: [],
		recent: [],
		pendingHandoffs: []
	};
	if (!d) return empty;
	if (scope === "all") return d;
	const asUser = {
		displayName: [user?.displayName, username].filter(Boolean).join(" ") || user?.displayName || null,
		primaryEmail: user?.primaryEmail ?? null
	};
	const mine = (c) => !!user?.id && c.authorId === user.id || namesMatchUser(asUser, c.authorName, c.technician, c.producer, c.accountRep);
	return {
		pendingHandoffs: d.pendingHandoffs.filter((p) => namesMatchUser(asUser, p.producer)),
		asks: d.asks.filter((c) => mine(c)),
		recent: d.recent.filter((c) => mine(c))
	};
}
//#endregion
export { Page as component };
