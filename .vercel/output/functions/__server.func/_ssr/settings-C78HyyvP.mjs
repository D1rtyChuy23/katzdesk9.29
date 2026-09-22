import { o as __toESM, r as __exportAll } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { L as Contrast, M as Keyboard, U as Check, i as Vibrate, p as StretchHorizontal, s as Type } from "../_libs/lucide-react.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { _ as cn, b as usePrefs } from "./router-1NWxggZt.mjs";
import { t as SelectField } from "./select-field-BxGIjVBi.mjs";
import { n as Button, r as Input } from "./input-COYCsX_T.mjs";
import { c as setRepActive, i as listReps, t as addRep } from "./reps-B2EuoM-m.mjs";
import { t as AppearanceIcon } from "./theme-toggle-BZhMzRtl.mjs";
import { n as listRosterCandidates, o as setRosterAdmin, r as listTechs, s as setTechActive, t as addTech } from "./roster-CEJORJjG.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-C78HyyvP.js
var settings_C78HyyvP_exports = /* @__PURE__ */ __exportAll({ component: () => Page });
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function RosterEditor() {
	const qc = useQueryClient();
	const roster = useQuery({
		queryKey: ["roster"],
		queryFn: () => listTechs()
	});
	const candidates = useQuery({
		queryKey: ["roster-candidates"],
		queryFn: () => listRosterCandidates(),
		enabled: !!roster.data?.canEdit && !roster.data?.ownerLocked
	});
	const [name, setName] = (0, import_react.useState)("");
	const add = useMutation({
		mutationFn: () => addTech({ data: { name } }),
		onSuccess: (next) => {
			setName("");
			qc.setQueryData(["roster"], next);
			toast.success(`${name.trim()} is on the roster`);
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add")
	});
	const toggle = useMutation({
		mutationFn: (p) => setTechActive({ data: {
			id: p.id,
			active: p.active
		} }),
		onSuccess: (next, p) => {
			qc.setQueryData(["roster"], next);
			toast.success(p.active ? `${p.name} is active` : `${p.name} removed from assign lists`);
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update")
	});
	const admin = useMutation({
		mutationFn: (userId) => setRosterAdmin({ data: { userId } }),
		onSuccess: (next) => {
			qc.setQueryData(["roster"], next);
			toast.success("Roster admin updated");
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not change admin")
	});
	if (!roster.data?.canEdit) return null;
	const techs = roster.data.techs;
	const active = techs.filter((t) => t.active);
	const inactive = techs.filter((t) => !t.active);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl border border-border bg-card p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-lg font-medium tracking-tight",
				children: "Service tech roster"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-0.5 text-xs text-muted-foreground",
				children: ["Only you can add or remove names. Tickets keep their current tech until you reassign them. Inactive names stay on history as “(inactive)” — they are not in assign lists.", roster.data.ownerLocked ? " This lock stays on the desk owner account." : roster.data.rosterAdminUsername ? ` Roster admin: ${roster.data.rosterAdminUsername}.` : ""]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-4 divide-y divide-border rounded-lg border border-border",
				children: active.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center justify-between gap-3 px-3 py-2.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-sm font-medium",
						children: t.name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						size: "sm",
						variant: "outline",
						disabled: toggle.isPending,
						onClick: () => toggle.mutate({
							id: t.id,
							active: false,
							name: t.name
						}),
						children: "Remove"
					})]
				}, t.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-3 flex flex-wrap gap-2",
				onSubmit: (e) => {
					e.preventDefault();
					if (!name.trim()) return;
					add.mutate();
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: name,
					onChange: (e) => setName(e.target.value),
					placeholder: "Add a technician…",
					className: "max-w-xs",
					"aria-label": "New technician name"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					disabled: add.isPending || !name.trim(),
					children: "Add"
				})]
			}),
			inactive.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs tracking-wide text-muted-foreground uppercase",
						children: "Inactive"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted-foreground",
						children: "Still shows on tickets already assigned. Not in assign lists."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-2 divide-y divide-border rounded-lg border border-border",
						children: inactive.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center justify-between gap-3 px-3 py-2.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-sm text-muted-foreground",
								children: [t.name, " (inactive)"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "button",
								size: "sm",
								variant: "ghost",
								disabled: toggle.isPending,
								onClick: () => toggle.mutate({
									id: t.id,
									active: true,
									name: t.name
								}),
								children: "Restore"
							})]
						}, t.id))
					})
				]
			}) : null,
			!roster.data.ownerLocked && (candidates.data?.length ?? 0) > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs tracking-wide text-muted-foreground uppercase",
						children: "Roster admin"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted-foreground",
						children: "Exactly one person can edit tech names. Other users cannot change this."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						className: "mt-2 max-w-xs",
						value: candidates.data?.find((c) => c.username === roster.data?.rosterAdminUsername)?.userId ?? "",
						onChange: (e) => {
							if (e.target.value) admin.mutate(e.target.value);
						},
						"aria-label": "Roster admin",
						children: (candidates.data ?? []).map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: c.userId,
							children: c.username
						}, c.userId))
					})
				]
			}) : null
		]
	});
}
function RepsEditor() {
	const qc = useQueryClient();
	const reps = useQuery({
		queryKey: ["reps"],
		queryFn: () => listReps()
	});
	const [name, setName] = (0, import_react.useState)("");
	const [initials, setInitials] = (0, import_react.useState)("");
	const add = useMutation({
		mutationFn: () => addRep({ data: {
			name,
			initials
		} }),
		onSuccess: (next) => {
			setName("");
			setInitials("");
			qc.setQueryData(["reps"], next);
			toast.success(`${name.trim()} is on the rep list`);
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add")
	});
	const toggle = useMutation({
		mutationFn: (p) => setRepActive({ data: {
			id: p.id,
			active: p.active
		} }),
		onSuccess: (next, p) => {
			qc.setQueryData(["reps"], next);
			toast.success(p.active ? `${p.name} is active` : `${p.name} hidden from the dropdown`);
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update")
	});
	if (!reps.data?.canEdit) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl border border-border bg-card p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-xl",
				children: "Sales reps"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted-foreground",
				children: "Dropdown-only list. Same lock as the service-tech roster — only you can add or remove names."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 divide-y divide-border",
				children: (reps.data.reps ?? []).map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center justify-between gap-2 py-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: r.active ? "text-sm" : "text-sm text-muted-foreground",
						children: [
							r.name,
							" (",
							r.initials,
							")",
							!r.active ? " · hidden" : ""
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						size: "sm",
						variant: "outline",
						disabled: toggle.isPending,
						onClick: () => toggle.mutate({
							id: r.id,
							active: !r.active,
							name: r.name
						}),
						children: r.active ? "Remove" : "Restore"
					})]
				}, r.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-3 flex flex-wrap gap-2",
				onSubmit: (e) => {
					e.preventDefault();
					add.mutate();
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: name,
						onChange: (e) => setName(e.target.value),
						placeholder: "Full name",
						className: "w-48"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: initials,
						onChange: (e) => setInitials(e.target.value),
						placeholder: "IN",
						className: "w-20"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						size: "sm",
						disabled: add.isPending || name.trim().length < 2,
						children: "Add rep"
					})
				]
			})
		]
	});
}
function Page() {
	const { prefs, update } = usePrefs();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
		className: "font-display text-3xl font-medium tracking-tight",
		children: "Settings"
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "mt-1 max-w-xl text-sm text-muted-foreground",
		children: "Display and ease-of-use for this device. Each person on the team can set their own — it stays on this browser."
	})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-6 grid gap-4 lg:max-w-2xl",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RosterEditor, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepsEditor, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				title: "Appearance",
				hint: "Dark mode is easier in the barn and on night calls. Match device follows the phone or laptop.",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Segmented, {
					value: prefs.appearance,
					onChange: (appearance) => update({ appearance }),
					options: [
						{
							id: "light",
							label: "Light",
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppearanceIcon, { value: "light" })
						},
						{
							id: "dark",
							label: "Dark",
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppearanceIcon, { value: "dark" })
						},
						{
							id: "system",
							label: "Match device",
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppearanceIcon, { value: "system" })
						}
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Preview, { appearance: prefs.appearance })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Text size",
				hint: "Large type helps when you’re standing back from a tablet or reading serials.",
				icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Type, { className: "size-4" }),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Segmented, {
					value: prefs.text,
					onChange: (text) => update({ text }),
					options: [{
						id: "default",
						label: "Default"
					}, {
						id: "large",
						label: "Large"
					}]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Density",
				hint: "Comfortable keeps 44px taps for the floor. Compact shows more rows on a laptop.",
				icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StretchHorizontal, { className: "size-4" }),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Segmented, {
					value: prefs.density,
					onChange: (density) => update({ density }),
					options: [{
						id: "comfortable",
						label: "Comfortable"
					}, {
						id: "compact",
						label: "Compact"
					}]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Contrast",
				hint: "High contrast strengthens borders and labels under shop lighting.",
				icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Contrast, { className: "size-4" }),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Segmented, {
					value: prefs.contrast,
					onChange: (contrast) => update({ contrast }),
					options: [{
						id: "standard",
						label: "Standard"
					}, {
						id: "high",
						label: "High"
					}]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Motion",
				hint: "Reduced turns off animation if it feels busy or you’re sensitive to movement.",
				icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Vibrate, { className: "size-4" }),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Segmented, {
					value: prefs.motion,
					onChange: (motion) => update({ motion }),
					options: [{
						id: "full",
						label: "Full"
					}, {
						id: "reduced",
						label: "Reduced"
					}]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "When I sign in",
				hint: "Resume opens the last page you were on — useful if you bounce between service and installs.",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Segmented, {
					value: prefs.resumeLast ? "resume" : "clock",
					onChange: (v) => update({ resumeLast: v === "resume" }),
					options: [{
						id: "clock",
						label: "Always Clock"
					}, {
						id: "resume",
						label: "Resume last page"
					}]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Keyboard",
				hint: "Press ? anywhere on the desk (except while typing).",
				icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Keyboard, { className: "size-4" }),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "divide-y divide-border rounded-xl border border-border",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shortcut, {
							keys: "⌘K",
							action: "Search accounts, serials, WOs"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shortcut, {
							keys: "?",
							action: "Open keyboard shortcuts"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shortcut, {
							keys: "Esc",
							action: "Close a sheet or dialog"
						})
					]
				})
			})
		]
	})] });
}
function Section({ title, hint, icon, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl border border-border bg-card p-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start gap-2",
			children: [icon ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "mt-0.5 text-muted-foreground",
				children: icon
			}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-lg font-medium tracking-tight",
				children: title
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-0.5 text-xs text-muted-foreground",
				children: hint
			})] })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-4",
			children
		})]
	});
}
function Segmented({ value, onChange, options }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex flex-wrap gap-2",
		role: "radiogroup",
		children: options.map((o) => {
			const on = o.id === value;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				role: "radio",
				"aria-checked": on,
				onClick: () => onChange(o.id),
				className: cn("inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 text-sm font-medium", on ? "bg-ink text-ink-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"),
				children: [on ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5 shrink-0" }) : o.icon, o.label]
			}, o.id);
		})
	});
}
function Shortcut({ keys, action }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: "flex items-center justify-between gap-3 px-3 py-2.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-sm",
			children: action
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", {
			className: "rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs",
			children: keys
		})]
	});
}
function Preview({ appearance }) {
	const { prefs } = usePrefs();
	const dark = appearance === "dark" || appearance === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("mt-4 overflow-hidden rounded-lg border border-border", dark ? "bg-ink text-ink-foreground" : "bg-paper text-foreground"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: cn("flex items-center justify-between px-3 py-2 text-xs", dark ? "bg-black/20" : "bg-muted/80"),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-display text-sm",
				children: "Katz Desk"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: dark ? "text-cream/60" : "text-muted-foreground",
				children: [prefs.text === "large" ? "Large type" : "Default type", prefs.density === "compact" ? " · Compact" : ""]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "px-3 py-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm font-medium",
				children: "Open call · The Gathery"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: cn("mt-0.5 text-xs", dark ? "text-cream/55" : "text-muted-foreground"),
				children: [
					"Serials and flags stay readable in ",
					dark ? "dark" : "light",
					" mode."
				]
			})]
		})]
	});
}
//#endregion
export { Page as component, settings_C78HyyvP_exports as t };
