import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { _ as setAccountCanAddCustomers, g as setAccountApproved, h as revokeInvite, i as denyAccount, l as listDeskAccounts, n as createInvite, o as getMyAccess, s as grantAllCanAddCustomers, u as listDeskInvites, v as setAccountRole } from "./access-3Tz151bB.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as SelectField } from "./select-field-BxGIjVBi.mjs";
import { d as sortDesk, l as SortSelect, n as SORT_DATE, p as useDeskSort, t as SORT_ALPHA } from "./sort-1yS_DCzE.mjs";
import { i as Label, n as Button, r as Input } from "./input-COYCsX_T.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/access-BLD8lC96.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function inviteBody(inv, origin) {
	return `You're invited to Katz Desk.

Open this link and create an account:
${origin}/login

Use ${[inv.username ? `username ${inv.username}` : null, inv.email ? `email ${inv.email}` : null].filter(Boolean).join(" or ") || "the username you were given"}. Invited accounts skip the wait.

If you already use Google or X, sign in with that, pick a username, and you'll be in.`;
}
function copyText(text) {
	return navigator.clipboard.writeText(text).then(() => toast.success("Copied"), () => toast.error("Could not copy"));
}
function Page() {
	const qc = useQueryClient();
	const me = useQuery({
		queryKey: ["access", "me"],
		queryFn: () => getMyAccess()
	});
	const list = useQuery({
		queryKey: ["access", "list"],
		queryFn: () => listDeskAccounts(),
		enabled: !!me.data?.isAdmin,
		refetchInterval: 8e3
	});
	const invites = useQuery({
		queryKey: ["access", "invites"],
		queryFn: () => listDeskInvites(),
		enabled: !!me.data?.isAdmin,
		refetchInterval: 8e3
	});
	const [email, setEmail] = (0, import_react.useState)("");
	const [username, setUsername] = (0, import_react.useState)("");
	const [inviteCanAdd, setInviteCanAdd] = (0, import_react.useState)(true);
	const setApproved = useMutation({
		mutationFn: (d) => setAccountApproved({ data: d }),
		onSuccess: (row) => {
			toast.success(row.approved ? `Approved ${row.username}` : `Revoked ${row.username}`);
			qc.invalidateQueries({ queryKey: ["access"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Failed")
	});
	const setPerm = useMutation({
		mutationFn: (d) => setAccountCanAddCustomers({ data: d }),
		onSuccess: (row) => {
			toast.success(row.canAddCustomers ? `${row.username} can add customers` : `Removed add-customer permission from ${row.username}`);
			qc.invalidateQueries({ queryKey: ["access"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Failed")
	});
	const grantAll = useMutation({
		mutationFn: () => grantAllCanAddCustomers(),
		onSuccess: (res) => {
			toast.success(res.updated ? `Granted add-customer permission to ${res.updated} ${res.updated === 1 ? "person" : "people"}` : "Everyone approved can already add customers");
			qc.invalidateQueries({ queryKey: ["access"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Failed")
	});
	const setRole = useMutation({
		mutationFn: (d) => setAccountRole({ data: d }),
		onSuccess: (row) => {
			toast.success(row.role ? `${row.username} is ${row.role === "sales" ? "Sales" : "Service"}` : `${row.username} has no role yet`);
			qc.invalidateQueries({ queryKey: ["access"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not set role")
	});
	const deny = useMutation({
		mutationFn: (userId) => denyAccount({ data: { userId } }),
		onSuccess: (row) => {
			toast.success(`Denied ${row.username}`);
			qc.invalidateQueries({ queryKey: ["access"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Failed")
	});
	const invite = useMutation({
		mutationFn: (d) => createInvite({ data: d }),
		onSuccess: (res) => {
			if (res.autoApproved.length) toast.success(`Approved ${res.autoApproved.join(", ")}`);
			else if (res.invite.status === "pending") toast.success("Invite saved. Copy the message and send it to them.");
			setEmail("");
			setUsername("");
			qc.invalidateQueries({ queryKey: ["access"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not invite")
	});
	const revoke = useMutation({
		mutationFn: (id) => revokeInvite({ data: { id } }),
		onSuccess: () => {
			toast.success("Invite revoked");
			qc.invalidateQueries({ queryKey: ["access"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Failed")
	});
	const [sort, setSort] = useDeskSort("access", "date-desc");
	const signingUp = (list.data ?? []).filter((a) => !a.usernameChosen && !a.denied);
	const pending = (list.data ?? []).filter((a) => !a.approved && !a.denied && a.usernameChosen);
	const denied = (list.data ?? []).filter((a) => a.denied && !a.approved);
	const active = (0, import_react.useMemo)(() => sortDesk(list.data ?? [], sort, {
		date: (a) => a.createdAt,
		name: (a) => a.username
	}).filter((a) => a.approved && a.usernameChosen), [list.data, sort]);
	const canAssignRoles = !!me.data?.canAssignRoles;
	const needsRole = active.filter((a) => !a.role);
	const pendingInvites = invites.data ?? [];
	const origin = typeof window !== "undefined" ? window.location.origin : "";
	function onInvite(e) {
		e.preventDefault();
		invite.mutate({
			email: email.trim() || void 0,
			username: username.trim() || void 0,
			canAddCustomers: inviteCanAdd
		});
	}
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
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 max-w-xl text-sm text-muted-foreground",
				children: ["Save an invite, then send them the login link. They get in as soon as they create an account with that email or username — no extra approval click. Grant “add customers” so they can put new account names on the list.", canAssignRoles ? " Assign Sales or Service so My View lands on the right boards. Unassigned people stay flagged until you pick a role." : ""]
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
			className: "mt-6 rounded-xl border border-border bg-card p-4 sm:p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-xs tracking-wide text-muted-foreground uppercase",
					children: "Invite people"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted-foreground",
					children: "Email, username, or both. The desk does not send the email for you — copy the invite after saving and send it yourself. If they already signed up, inviting them approves them now."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					onSubmit: onInvite,
					className: "mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "invite-email",
							children: "Email"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "invite-email",
							type: "email",
							autoComplete: "off",
							className: "mt-1",
							placeholder: "name@katzcoffee.com",
							value: email,
							onChange: (e) => setEmail(e.target.value)
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "invite-username",
							children: "Username"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "invite-username",
							autoComplete: "off",
							className: "mt-1",
							placeholder: "optional, e.g. amanda.s",
							value: username,
							onChange: (e) => setUsername(e.target.value)
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							disabled: invite.isPending,
							className: "h-10",
							children: invite.isPending ? "Saving…" : "Save invite"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "mt-4 flex items-start gap-2 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "checkbox",
						className: "mt-0.5 size-4 accent-primary",
						checked: inviteCanAdd,
						onChange: (e) => setInviteCanAdd(e.target.checked)
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Allow them to add new customer names", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mt-0.5 block text-xs text-muted-foreground",
						children: "They still cannot rename or remove accounts. Turn this off if they should only pick from the existing list."
					})] })]
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: [
					"Pending invites (",
					pendingInvites.length,
					")"
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "mt-2 overflow-hidden rounded-xl border border-border bg-card",
				children: [pendingInvites.map((inv) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InviteRow, {
					inv,
					origin,
					onRevoke: () => revoke.mutate(inv.id),
					revoking: revoke.isPending
				}, inv.id)), pendingInvites.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "px-4 py-6 text-sm text-muted-foreground",
					children: "No pending invites."
				}) : null]
			})]
		}),
		signingUp.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "text-xs tracking-wide text-muted-foreground uppercase",
					children: [
						"Signing up (",
						signingUp.length,
						")"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted-foreground",
					children: "They reached the desk but haven’t picked a username yet. They’ll show as approved or waiting once they finish."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-2 overflow-hidden rounded-xl border border-border bg-card",
					children: signingUp.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-medium",
								children: a.username
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "truncate text-sm text-muted-foreground",
								children: [a.email ?? "No email", a.approved ? " · invited, finishing setup" : " · finishing setup"]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-2",
							children: [!a.approved ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								disabled: setApproved.isPending,
								onClick: () => setApproved.mutate({
									userId: a.userId,
									approved: true
								}),
								children: "Approve"
							}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: "outline",
								disabled: deny.isPending,
								onClick: () => deny.mutate(a.userId),
								children: "Deny"
							})]
						})]
					}, a.userId))
				})
			]
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: [
					"Waiting for approval (",
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
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							disabled: setApproved.isPending,
							onClick: () => setApproved.mutate({
								userId: a.userId,
								approved: true
							}),
							children: "Approve"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "outline",
							disabled: deny.isPending,
							onClick: () => deny.mutate(a.userId),
							children: "Deny"
						})]
					})]
				}, a.userId)), pending.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "px-4 py-6 text-sm text-muted-foreground",
					children: "No one is waiting."
				}) : null]
			})]
		}),
		denied.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: [
					"Denied (",
					denied.length,
					")"
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-2 overflow-hidden rounded-xl border border-border bg-card",
				children: denied.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
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
				}, a.userId))
			})]
		}) : null,
		canAssignRoles && needsRole.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "text-xs tracking-wide text-warning uppercase",
					children: [
						"Needs a role (",
						needsRole.length,
						")"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted-foreground",
					children: "Existing logins stay unassigned until you pick Sales or Service. Role only changes My View defaults — it does not hide tickets."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-2 overflow-hidden rounded-xl border border-warning/40 bg-card",
					children: needsRole.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
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
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RolePicker, {
							value: a.role,
							disabled: setRole.isPending,
							onChange: (role) => setRole.mutate({
								userId: a.userId,
								role
							})
						})]
					}, `role-${a.userId}`))
				})
			]
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "text-xs tracking-wide text-muted-foreground uppercase",
					children: [
						"Approved (",
						active.length,
						")"
					]
				}), active.some((a) => !a.isAdmin && !a.canAddCustomers) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					variant: "outline",
					disabled: grantAll.isPending,
					onClick: () => grantAll.mutate(),
					children: "Allow all to add customers"
				}) : null]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-2 overflow-hidden rounded-xl border border-border bg-card",
				children: active.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "font-medium",
							children: [
								a.username,
								a.isAdmin ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ml-2 text-xs text-muted-foreground",
									children: "admin"
								}) : a.canAddCustomers ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ml-2 text-xs text-muted-foreground",
									children: "can add customers"
								}) : null,
								canAssignRoles && a.role ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ml-2 text-xs text-muted-foreground",
									children: a.role
								}) : canAssignRoles && !a.role ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ml-2 text-xs text-warning",
									children: "needs role"
								}) : null
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "truncate text-sm text-muted-foreground",
							children: a.email ?? "No email"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [canAssignRoles ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RolePicker, {
							value: a.role,
							disabled: setRole.isPending,
							onChange: (role) => setRole.mutate({
								userId: a.userId,
								role
							})
						}) : null, !a.isAdmin ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: a.canAddCustomers ? "ink" : "outline",
							disabled: setPerm.isPending,
							onClick: () => setPerm.mutate({
								userId: a.userId,
								canAddCustomers: !a.canAddCustomers
							}),
							children: a.canAddCustomers ? "Can add customers" : "Allow add customers"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "outline",
							disabled: setApproved.isPending,
							onClick: () => setApproved.mutate({
								userId: a.userId,
								approved: false
							}),
							children: "Revoke"
						})] }) : null]
					})]
				}, a.userId))
			})]
		})
	] });
}
function RolePicker({ value, onChange, disabled }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
		className: "h-9 w-36",
		value: value ?? "",
		disabled,
		onChange: (e) => {
			const v = e.target.value;
			onChange(v === "sales" || v === "service" ? v : null);
		},
		allowEmpty: true,
		emptyLabel: "Needs role",
		"aria-label": "Role",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
			value: "sales",
			children: "Sales"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
			value: "service",
			children: "Service"
		})]
	});
}
function InviteRow({ inv, origin, onRevoke, revoking }) {
	const body = inviteBody(inv, origin);
	const mailto = inv.email ? `mailto:${encodeURIComponent(inv.email)}?subject=${encodeURIComponent("You're invited to Katz Desk")}&body=${encodeURIComponent(body)}` : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: "flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "min-w-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-medium",
				children: inv.username || inv.email || "Invite"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "truncate text-sm text-muted-foreground",
				children: [
					[inv.email, inv.username && inv.email ? `@${inv.username}` : null].filter(Boolean).join(" · ") || "No email",
					` · from ${inv.invitedBy}`,
					inv.canAddCustomers ? " · can add customers" : ""
				]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					variant: "outline",
					onClick: () => void copyText(body),
					children: "Copy invite"
				}),
				mailto ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					variant: "outline",
					asChild: true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: mailto,
						children: "Email them"
					})
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					variant: "outline",
					disabled: revoking,
					onClick: onRevoke,
					children: "Revoke"
				})
			]
		})]
	});
}
//#endregion
export { Page as component };
