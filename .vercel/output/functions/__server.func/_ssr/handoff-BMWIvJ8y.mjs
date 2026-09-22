import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { _ as namesMatchUser } from "./lookups-BkjR5sto.mjs";
import { o as getMyAccess } from "./access-3Tz151bB.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { v as useCurrentUser } from "./router-1NWxggZt.mjs";
import { L as resolveComment, b as handoffDeal, c as claimComment, t as addComment, v as getHandoff } from "./api-CgwyWugK.mjs";
import { t as OpenLink } from "./open-link-oQ0V2s2m.mjs";
import { d as sortDesk, l as SortSelect, n as SORT_DATE, p as useDeskSort, t as SORT_ALPHA } from "./sort-1yS_DCzE.mjs";
import { t as Badge } from "./badge-C8SL_nG4.mjs";
import { r as listTeammates } from "./notify-CruvKMVL.mjs";
import { n as Button } from "./input-COYCsX_T.mjs";
import { n as MentionField, r as PingButton, t as MentionBody } from "./ping-button-B3Neap2C.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/handoff-BMWIvJ8y.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function HandoffReply({ entityType, entityId }) {
	const qc = useQueryClient();
	const [open, setOpen] = (0, import_react.useState)(false);
	const [body, setBody] = (0, import_react.useState)("");
	const [sent, setSent] = (0, import_react.useState)([]);
	const teammates = useQuery({
		queryKey: ["teammates"],
		queryFn: () => listTeammates(),
		enabled: open
	});
	const send = useMutation({
		mutationFn: () => addComment({ data: {
			entityType,
			entityId,
			body,
			askTeam: null
		} }),
		onSuccess: (saved) => {
			setBody("");
			setOpen(false);
			setSent((prev) => [...prev, saved]);
			qc.invalidateQueries({ queryKey: [
				"comments",
				entityType,
				entityId
			] });
			qc.invalidateQueries({ queryKey: [
				"activity",
				entityType,
				entityId
			] });
			qc.invalidateQueries({ queryKey: ["handoff"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["notifications"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not send")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0",
		children: [sent.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mb-2 space-y-2",
			children: sent.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "rounded-lg border border-border bg-background px-3 py-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs font-medium",
					children: [c.ownerLabel, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-1 font-normal text-muted-foreground",
						children: "replied"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-1 text-sm leading-relaxed",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MentionBody, { text: c.body })
				})]
			}, c.id))
		}) : null, open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "space-y-2",
			onSubmit: (e) => {
				e.preventDefault();
				if (body.trim()) send.mutate();
			},
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MentionField, {
				multiline: true,
				value: body,
				onChange: setBody,
				teammates: teammates.data ?? [],
				placeholder: "Write a reply…"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap justify-end gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					size: "sm",
					variant: "ghost",
					onClick: () => {
						setOpen(false);
						setBody("");
					},
					children: "Cancel"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					size: "sm",
					disabled: send.isPending || !body.trim(),
					children: send.isPending ? "Sending…" : "Send"
				})]
			})]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: "h-8 rounded-full px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
			onClick: () => setOpen(true),
			children: "Reply"
		})]
	});
}
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
	const claim = useMutation({
		mutationFn: (id) => claimComment({ data: { id } }),
		onSuccess: () => {
			toast.success("Note is under your name");
			qc.invalidateQueries({ queryKey: ["handoff"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["comments"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not claim")
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
		name: (c) => c.customer ?? c.ownerLabel
	}), [filtered.asks, sort]);
	const sortedRecent = (0, import_react.useMemo)(() => sortDesk(filtered.recent, sort, {
		date: (c) => c.createdAt,
		name: (c) => c.customer ?? c.ownerLabel
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
				children: "The conversation between sales and service. Mine shows asks, notes, and completed deals that belong to you. Notes without a poster show as Service until someone claims them."
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
						className: "py-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center justify-between gap-3",
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
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HandoffReply, {
								entityType: "deal",
								entityId: p.dealId
							})
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
										children: c.ownerLabel
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [
											c.canClaim ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												className: "h-8 rounded-full px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
												disabled: claim.isPending,
												onClick: () => claim.mutate(c.id),
												children: "Claim"
											}) : null,
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PingButton, {
												size: "xs",
												entityType: c.entityType,
												entityId: c.entityId,
												commentId: c.id,
												pingedAt: c.pingedAt,
												contextLabel: `${c.customer ?? c.entityType} · ${c.body.slice(0, 80)}`,
												defaultNote: c.body
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												className: "text-xs text-muted-foreground underline-offset-2 hover:underline",
												onClick: () => resolve.mutate(c.id),
												children: "Mark answered"
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-2",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HandoffReply, {
										entityType: c.entityType,
										entityId: c.entityId
									})
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
						children: sortedRecent.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-medium",
										children: c.ownerLabel
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-muted-foreground",
										children: [" · ", c.customer ?? c.entityType]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1",
									children: [c.canClaim ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "h-8 rounded-full px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
										disabled: claim.isPending,
										onClick: () => claim.mutate(c.id),
										children: "Claim"
									}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PingButton, {
										size: "xs",
										entityType: c.entityType,
										entityId: c.entityId,
										commentId: c.id,
										pingedAt: c.pingedAt,
										contextLabel: `${c.customer ?? c.entityType} · ${c.body.slice(0, 80)}`,
										defaultNote: c.body
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-sm leading-relaxed text-muted-foreground",
								children: c.body
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-2",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HandoffReply, {
									entityType: c.entityType,
									entityId: c.entityId
								})
							})
						] }, c.id))
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
