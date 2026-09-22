import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { b as Plus, t as X } from "../_libs/lucide-react.mjs";
import { _ as cn } from "./router-1NWxggZt.mjs";
import { a as Textarea, i as Label, n as Button } from "./input-COYCsX_T.mjs";
import { n as SETTING_FIELDS, r as filledSettingNames, t as DEFAULT_SETTING_NAMES } from "./recipe-fields-DqZtnvK8.mjs";
import { n as CustomerCombo, r as EquipmentCombo } from "./directory-fields-BvcLee-k.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/recipe-form-BLdODl00.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function RecipeForm({ draft, models: _models, customers: _customers, pending, copyPending, onSave, onCopy }) {
	const recipe = draft.recipe;
	const settingsSrc = recipe ?? null;
	const [modelPick, setModelPick] = (0, import_react.useState)(recipe?.equipmentModel || draft.equipmentModel || "");
	const [customerPick, setCustomerPick] = (0, import_react.useState)(recipe ? recipe.customer ?? "" : draft.customer ? draft.customer : "");
	const [visible, setVisible] = (0, import_react.useState)(() => new Set(recipe ? filledSettingNames(recipe) : DEFAULT_SETTING_NAMES));
	const [copyTo, setCopyTo] = (0, import_react.useState)("");
	const isHouse = !!recipe && !recipe.customer;
	const hidden = SETTING_FIELDS.filter((f) => !visible.has(f.name));
	const shown = SETTING_FIELDS.filter((f) => visible.has(f.name));
	const sourceName = draft.source ? draft.source.customer ? `${draft.source.customer} · ${draft.source.equipmentModel}` : `House · ${draft.source.equipmentModel}` : recipe?.copiedFrom ? "another recipe" : null;
	function hide(name) {
		setVisible((prev) => {
			const next = new Set(prev);
			next.delete(name);
			return next;
		});
	}
	function show(name) {
		setVisible((prev) => new Set(prev).add(name));
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		className: "space-y-4",
		onSubmit: (e) => {
			e.preventDefault();
			const fd = new FormData(e.currentTarget);
			const model = String(fd.get("equipmentModel") || "").trim();
			if (!model) return;
			const customerRaw = isHouse ? "" : String(fd.get("customer") || "").trim();
			const customer = customerRaw ? customerRaw : null;
			const val = (name) => visible.has(name) ? String(fd.get(name) || "") || null : null;
			onSave({
				id: recipe?.id,
				equipmentModel: model,
				customer,
				installId: draft.installId,
				copiedFrom: draft.copiedFrom || recipe?.copiedFrom || null,
				coffee1: val("coffee1"),
				coffee2: val("coffee2"),
				coffee3: val("coffee3"),
				powder1: val("powder1"),
				powder2: val("powder2"),
				powder3: val("powder3"),
				americano1: val("americano1"),
				americano2: val("americano2"),
				americano3: val("americano3"),
				tea1: val("tea1"),
				tea2: val("tea2"),
				milk: val("milk"),
				notes: String(fd.get("notes") || "") || null
			});
		},
		children: [
			sourceName && !recipe ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground",
				children: "Settings start blank. Fill them in for this account — nothing is copied automatically."
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 sm:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: isHouse ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Customer" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm",
						children: "House template"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted-foreground",
						children: "Saving updates this shared template. Assign it to a customer below — that creates a copy and leaves the template in place."
					})
				] }) : draft.lockCustomer ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Customer" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm",
						children: draft.customer || "House template"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "hidden",
						name: "customer",
						value: draft.customer ?? ""
					})
				] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
					name: "customer",
					value: customerPick,
					onChange: setCustomerPick,
					placeholder: "Search customers — blank is a house template"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: "Leave blank for a house template shared by every account."
				})] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentCombo, {
					name: "equipmentModel",
					value: modelPick,
					onChange: setModelPick,
					required: true,
					placeholder: "Search the full equipment list…"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: "Scroll the list or type a model to add it."
				})] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-3 sm:grid-cols-2",
				children: shown.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: cn("relative rounded-lg border border-border p-3 pt-2", f.name === "milk" && "sm:col-span-2"),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex items-center justify-between gap-2 pr-10",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: f.name,
								children: f.label
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => hide(f.name),
							className: "absolute top-1 right-1 flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
							"aria-label": `Remove ${f.label}`,
							title: `Remove ${f.label}`,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							id: f.name,
							name: f.name,
							className: "mt-1 min-h-20",
							defaultValue: settingsSrc?.[f.name] ?? "",
							placeholder: "Dose, yield, time, temp…"
						})
					]
				}, f.name))
			}),
			hidden.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: "Add a setting"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2 flex flex-wrap gap-2",
				children: hidden.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => show(f.name),
					className: "inline-flex h-9 items-center gap-1 rounded-full border border-border bg-card px-3 text-sm hover:bg-muted",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), f.label]
				}, f.name))
			})] }) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
				htmlFor: "notes",
				children: "Notes"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
				id: "notes",
				name: "notes",
				className: "mt-1",
				defaultValue: settingsSrc?.notes ?? ""
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex justify-end",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					disabled: pending || !modelPick,
					children: recipe ? "Save recipe" : draft.customer ? `Save for ${draft.customer}` : "Create recipe"
				})
			}),
			recipe && onCopy ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-lg border border-border p-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-medium",
						children: isHouse ? "Assign to a customer" : "Reuse for another customer"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-0.5 text-xs text-muted-foreground",
						children: isHouse ? "Keeps this house template. Creates a customer recipe with the same settings — fill those in here first." : "Copies these settings onto a new account. Shared with techs and sales."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 flex flex-col gap-2 sm:flex-row",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex-1",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
								label: "",
								value: copyTo,
								onChange: setCopyTo,
								placeholder: "Pick a customer…"
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "secondary",
							disabled: !copyTo || copyPending,
							onClick: () => onCopy({
								sourceId: recipe.id,
								customer: copyTo
							}),
							children: isHouse ? "Assign" : "Copy recipe"
						})]
					})
				]
			}) : null
		]
	});
}
//#endregion
export { RecipeForm as t };
