import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { r as createServerFn } from "./ssr.mjs";
import { a as deskMiddleware, r as createSsrRpc } from "./access-3Tz151bB.mjs";
import { k as Mail, x as Phone } from "../_libs/lucide-react.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as SelectField } from "./select-field-BxGIjVBi.mjs";
import { t as Badge } from "./badge-C8SL_nG4.mjs";
import { n as Button } from "./input-COYCsX_T.mjs";
import { n as CustomerCombo } from "./directory-fields-BvcLee-k.mjs";
import { S as statusTone, y as roleLabel } from "./network-feNzLxWy.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/provider-dispatch-CwfIUm28.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var listNetwork = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("0e70cec8a743027415d0460951e6e2bb501309027c1759c4c98cfd78df7764d5"));
var getProvider = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("6e67d51c0c64562bbed03eea6fbb1e7c689b83ef33496797ea9f1a8a23c70aa9"));
var upsertProvider = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("f62afaeae21ab0e89d7d27769b2f5064cb3e75f64a9ea65009068831d0434921"));
var renameProvider = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("5272252cb350fffbd8b8d56c4ef404ee93249ca615f69b19500c65e08ca968d3"));
var addProviderLocation = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("7d30dfaa7a40d51c27cd0ce998e25cfeded40af2ff16826301ad1363906ce978"));
var removeProviderLocation = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("d542ae756f2e6694dce801180f201b4d169c51d7a4538e3133a8696e2e25728c"));
var addProviderContact = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("f2825516656623b695881938cec0b6cf9876e9c7c29a937a8cdcbfa5be64c879"));
var removeProviderContact = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("a534ea58c5fe888eb5efb486c3893ae8da4fdc6fa69c93aee3dab0efe6f088fa"));
var addProviderAddress = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("382dd0efa33ba73974579c8835f506ae0d04e33a2a6b5c2df3a7598f86087361"));
var removeProviderAddress = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("91a2ebe1261556f11fcc6a931cb07fb974490d2efb9a57f84f4b4edd6b44fd73"));
var archiveProvider = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("471944d55e1c65b4213049ee898d032a581f48ae35180995f970ee884a74ec4a"));
var getCustomerProviders = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("683ce4e118843b9882fa4d3ef4aae93e7c9911c090294ea307f851a3f443ba3b"));
var assignCustomerProvider = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("2808eee236ac8a01d9b5df827bec7737d82a7b482025f6f1765ce51c74d36ecf"));
var unassignCustomerProvider = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("459028e7e9941b4f9e5d3cb9f2219c189d90cc6b094ae31d8cfcbce57606b7ed"));
var setProviderRole = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("e1f6b5e1ee21f932bd78b1ddbf8e596c45e7296aac8591d390fcd0ce141b2d8c"));
function ProviderDispatchBlock({ customer, assignable = false }) {
	const name = customer.trim();
	const qc = useQueryClient();
	const links = useQuery({
		queryKey: ["customer-providers", name],
		queryFn: () => getCustomerProviders({ data: { customer: name } }),
		enabled: name.length > 0
	});
	const drop = useMutation({
		mutationFn: (linkId) => unassignCustomerProvider({ data: { linkId } }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["customer-providers"] });
			qc.invalidateQueries({ queryKey: ["network"] });
		}
	});
	if (!name) return null;
	const rows = links.data ?? [];
	if (!rows.length && !assignable) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl border border-border bg-card p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex items-start justify-between gap-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase",
					children: "Out of Network dispatch"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-0.5 text-xs text-muted-foreground",
					children: rows.length ? "Call the primary first. Secondary is backup." : "No 3rd-party tech is assigned to this account yet."
				})] })
			}),
			rows.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 space-y-2",
				children: rows.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DispatchCard, {
					role: l.role,
					name: l.provider.name,
					phone: l.provider.dispatchPhone,
					email: l.provider.dispatchEmail,
					coverage: l.provider.states?.length ? l.provider.states.join(" · ") : l.provider.coverage,
					status: l.provider.status,
					onRemove: assignable ? () => drop.mutate(l.linkId) : void 0
				}) }, l.linkId))
			}) : null,
			assignable ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AssignProviderForm, { customer: name }) : null
		]
	});
}
function DispatchCard({ role, name, phone, email, coverage, status, onRemove }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-border bg-background px-3 py-2.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-center gap-1.5",
			children: [
				role ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					variant: role === "primary" ? "ink" : "outline",
					children: roleLabel(role)
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "min-w-0 flex-1 font-medium",
					children: name
				}),
				status ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					variant: statusTone(status),
					children: status
				}) : null,
				onRemove ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "h-8 rounded-full px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground",
					onClick: (e) => {
						e.stopPropagation();
						onRemove();
					},
					children: "Remove"
				}) : null
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-1.5 flex flex-col gap-0.5 text-sm",
			children: [
				phone ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
					href: `tel:${phone.replace(/[^\d+]/g, "")}`,
					className: "inline-flex items-center gap-1.5 text-foreground hover:underline",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Phone, { className: "size-3.5 text-muted-foreground" }), phone]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: "No dispatch phone on file"
				}),
				email ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
					href: `mailto:${email.split(/\s/)[0]}`,
					className: "inline-flex items-center gap-1.5 break-all hover:underline",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mail, { className: "size-3.5 shrink-0 text-muted-foreground" }), email]
				}) : null,
				coverage ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 line-clamp-2 text-xs text-muted-foreground",
					children: coverage
				}) : null
			]
		})]
	});
}
function AssignProviderForm({ customer }) {
	const qc = useQueryClient();
	const net = useQuery({
		queryKey: ["network"],
		queryFn: () => listNetwork()
	});
	const [providerId, setProviderId] = (0, import_react.useState)("");
	const [role, setRole] = (0, import_react.useState)("additional");
	const add = useMutation({
		mutationFn: () => assignCustomerProvider({ data: {
			customer,
			providerId: Number(providerId),
			role
		} }),
		onSuccess: (row) => {
			toast.success(`${row.provider.name} is on ${customer}`);
			setProviderId("");
			qc.invalidateQueries({ queryKey: ["customer-providers"] });
			qc.invalidateQueries({ queryKey: ["network"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not assign")
	});
	const providers = net.data?.providers ?? [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		className: "mt-3 flex flex-col gap-2 sm:flex-row sm:items-end",
		onSubmit: (e) => {
			e.preventDefault();
			if (providerId) add.mutate();
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: "Add a provider"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
					className: "mt-1",
					value: providerId,
					onChange: (e) => setProviderId(e.target.value),
					allowEmpty: true,
					children: providers.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: p.id,
						children: p.name
					}, p.id))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
				className: "sm:w-36",
				value: role,
				onChange: (e) => setRole(e.target.value),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "primary",
						children: "Primary"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "secondary",
						children: "Secondary"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "additional",
						children: "Additional"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "submit",
				size: "sm",
				disabled: !providerId || add.isPending,
				children: "Add"
			})
		]
	});
}
function ProviderAccountList({ providerId, accounts }) {
	const qc = useQueryClient();
	const [customer, setCustomer] = (0, import_react.useState)("");
	const [role, setRole] = (0, import_react.useState)("primary");
	const add = useMutation({
		mutationFn: () => assignCustomerProvider({ data: {
			customer,
			providerId,
			role
		} }),
		onSuccess: () => {
			toast.success("Account assigned");
			setCustomer("");
			qc.invalidateQueries({ queryKey: ["network"] });
			qc.invalidateQueries({ queryKey: ["customer-providers"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not assign")
	});
	const drop = useMutation({
		mutationFn: (linkId) => unassignCustomerProvider({ data: { linkId } }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["network"] });
			qc.invalidateQueries({ queryKey: ["customer-providers"] });
		}
	});
	const roleMut = useMutation({
		mutationFn: (d) => setProviderRole({ data: d }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["network"] });
			qc.invalidateQueries({ queryKey: ["customer-providers"] });
		}
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
			className: "font-display text-lg",
			children: "Assigned accounts"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs text-muted-foreground",
			children: "Pick from the customer list. Primary is who we call first."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "mt-3 flex flex-col gap-2 sm:flex-row sm:items-end",
			onSubmit: (e) => {
				e.preventDefault();
				if (customer.trim()) add.mutate();
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "min-w-0 flex-1",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
						label: "Customer",
						value: customer,
						onChange: setCustomer,
						allowCreate: false
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
					className: "sm:w-36",
					value: role,
					onChange: (e) => setRole(e.target.value),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "primary",
							children: "Primary"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "secondary",
							children: "Secondary"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "additional",
							children: "Additional"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					size: "sm",
					disabled: !customer.trim() || add.isPending,
					children: "Assign"
				})
			]
		}),
		accounts.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-3 text-sm text-muted-foreground",
			children: "No accounts yet."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-3 divide-y divide-border rounded-xl border border-border",
			children: accounts.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex flex-wrap items-center gap-2 px-3 py-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "min-w-0 flex-1 font-medium",
						children: a.customer
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
						className: "w-32",
						value: a.role,
						onChange: (e) => roleMut.mutate({
							linkId: a.linkId,
							role: e.target.value
						}),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "primary",
								children: "Primary"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "secondary",
								children: "Secondary"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "additional",
								children: "Additional"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "h-10 px-2 text-xs text-muted-foreground hover:text-foreground",
						onClick: () => drop.mutate(a.linkId),
						children: "Remove"
					})
				]
			}, a.linkId))
		})
	] });
}
//#endregion
export { addProviderContact as a, getProvider as c, removeProviderContact as d, removeProviderLocation as f, addProviderAddress as i, listNetwork as l, upsertProvider as m, ProviderAccountList as n, addProviderLocation as o, renameProvider as p, ProviderDispatchBlock as r, archiveProvider as s, DispatchCard as t, removeProviderAddress as u };
