import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { C as listComments, L as resolveComment, c as claimComment, t as addComment, x as listActivity } from "./api-CgwyWugK.mjs";
import { t as Badge } from "./badge-C8SL_nG4.mjs";
import { r as listTeammates } from "./notify-CruvKMVL.mjs";
import { n as Button } from "./input-COYCsX_T.mjs";
import { n as MentionField, r as PingButton, t as MentionBody } from "./ping-button-B3Neap2C.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/thread-y3SErmOf.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function actionLine(action, detail) {
	if (action === "opened") return detail ? `opened this · ${detail}` : "opened this";
	if (action === "note") return detail ? `left a note · ${detail}` : "left a note";
	if (action === "status") return detail ?? "updated status";
	if (action === "reason") return detail ?? "updated reason delayed";
	if (action === "assigned-asset") return detail ?? "assigned equipment";
	if (action === "unassigned-asset") return detail ? `removed ${detail}` : "removed equipment";
	if (action === "returned") return detail ? `returned to ${detail}` : "returned to warehouse";
	if (action === "sold") return detail ? `sold to ${detail}` : "marked sold";
	if (action === "updated") return detail ?? "saved changes";
	return detail || action;
}
function when(iso) {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	return d.toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit"
	});
}
function ActivityTrail({ entityType, entityId }) {
	const rows = useQuery({
		queryKey: [
			"activity",
			entityType,
			entityId
		],
		queryFn: () => listActivity({ data: {
			entityType,
			entityId
		} }),
		refetchInterval: 8e3
	}).data ?? [];
	if (!rows.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "border-t border-border px-5 py-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "font-display text-lg font-medium",
				children: "Who changed this"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: "Every save and assignment is tagged to a username."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
				className: "mt-3 space-y-2",
				children: rows.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex flex-wrap items-baseline justify-between gap-2 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "font-medium",
							children: ["@", a.actorName ?? "teammate"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-muted-foreground",
							children: [" ", actionLine(a.action, a.detail)]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", {
						className: "shrink-0 text-xs text-muted-foreground",
						children: when(a.createdAt)
					})]
				}, a.id))
			})
		]
	});
}
function Thread({ entityType, entityId }) {
	const qc = useQueryClient();
	const [body, setBody] = (0, import_react.useState)("");
	const [ask, setAsk] = (0, import_react.useState)("");
	const comments = useQuery({
		queryKey: [
			"comments",
			entityType,
			entityId
		],
		queryFn: () => listComments({ data: {
			entityType,
			entityId
		} })
	});
	const teammates = useQuery({
		queryKey: ["teammates"],
		queryFn: () => listTeammates()
	});
	const add = useMutation({
		mutationFn: () => addComment({ data: {
			entityType,
			entityId,
			body,
			askTeam: ask || null
		} }),
		onSuccess: () => {
			setBody("");
			setAsk("");
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
		onError: (e) => toast.error(e.message)
	});
	const resolve = useMutation({
		mutationFn: (id) => resolveComment({ data: {
			id,
			resolved: true
		} }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: [
				"comments",
				entityType,
				entityId
			] });
			qc.invalidateQueries({ queryKey: ["handoff"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		}
	});
	const claim = useMutation({
		mutationFn: (id) => claimComment({ data: { id } }),
		onSuccess: () => {
			toast.success("Note is under your name");
			qc.invalidateQueries({ queryKey: [
				"comments",
				entityType,
				entityId
			] });
			qc.invalidateQueries({ queryKey: ["handoff"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: (e) => toast.error(e.message)
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActivityTrail, {
				entityType,
				entityId
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "px-5 pt-4 font-display text-lg font-medium",
				children: "Handoff notes"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-5 text-xs text-muted-foreground",
				children: "Tag a teammate with @username. Ping sends them a bell notification."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-3 px-5 py-4",
				children: (comments.data ?? []).length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "No notes yet. Leave the first one."
				}) : comments.data.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "rounded-lg border border-border bg-background p-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm font-medium",
								children: c.ownerLabel
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", {
								className: "text-xs text-muted-foreground",
								children: new Date(c.createdAt).toLocaleString("en-US", {
									month: "short",
									day: "numeric",
									hour: "numeric",
									minute: "2-digit"
								})
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MentionBody, { text: c.body }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 flex flex-wrap items-center gap-2",
							children: [
								c.askTeam && !c.resolved ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
									variant: "warn",
									children: ["Ask ", c.askTeam]
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PingButton, {
									size: "xs",
									entityType,
									entityId,
									commentId: c.id,
									pingedAt: c.pingedAt,
									contextLabel: `${entityType} #${entityId} · ${c.body.slice(0, 80)}`,
									defaultNote: c.body
								}),
								c.canClaim ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "h-8 rounded-full px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
									disabled: claim.isPending,
									onClick: () => claim.mutate(c.id),
									children: "Claim"
								}) : null,
								c.askTeam && !c.resolved ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "text-xs text-muted-foreground underline-offset-2 hover:underline",
									onClick: () => resolve.mutate(c.id),
									children: "Mark answered"
								}) : null
							]
						})
					]
				}, c.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "border-t border-border p-4",
				onSubmit: (e) => {
					e.preventDefault();
					if (body.trim()) add.mutate();
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MentionField, {
					multiline: true,
					value: body,
					onChange: setBody,
					teammates: teammates.data ?? [],
					placeholder: "Write a note… tag @username to ping them"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2 flex flex-wrap items-center justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex gap-1",
						children: [
							"",
							"sales",
							"service"
						].map((v) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setAsk(v),
							className: `h-8 rounded-full px-3 text-xs font-medium ${ask === v ? "bg-ink text-ink-foreground" : "bg-muted text-foreground"}`,
							children: v === "" ? "Note" : v === "sales" ? "Ask sales" : "Ask service"
						}, v || "none"))
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PingButton, {
							size: "xs",
							entityType,
							entityId,
							contextLabel: `Follow up on this ${entityType}`,
							defaultNote: body
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							size: "sm",
							disabled: add.isPending || !body.trim(),
							children: "Post"
						})]
					})]
				})]
			})
		]
	});
}
//#endregion
export { Thread as t };
