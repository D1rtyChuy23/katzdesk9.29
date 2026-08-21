import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { l as Plus, t as X, y as BookOpen } from "../_libs/lucide-react.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { n as cn, t as Button } from "./button-6ZsGYj3J.mjs";
import { B as updatePm, C as listDirectory, I as updateDeal, L as updateInstall, O as listRecipes, P as unassignAssetFromInstall, V as upsertRecipe, c as copyRecipe, s as assignAssetToInstall, x as listCustomers, y as listAssets, z as updateModule } from "./api-B23zb1CT.mjs";
import { i as SheetTitle, n as SheetContent, r as SheetHeader, t as Sheet } from "./sheet-CqTk9YRH.mjs";
import { a as EQUIP_STATUSES, c as MODULE_TYPES, d as PM_STATUSES, f as PM_STYLES, g as TECHNICIANS, h as REQS_READY, l as PARTS_STATUSES, o as MODULE_PLATFORMS, p as PRODUCERS, s as MODULE_STATUSES, u as PAYMENT_TERMS } from "./lookups-sAI9gyB5.mjs";
import { c as moneyExact } from "./clock-CDIQNAok.mjs";
import { l as SelectField } from "./sort-C5YlOVRH.mjs";
import { n as Label, r as Textarea, t as Input } from "./input-D-eo25vp.mjs";
import { c as StatusBadge, n as FlagBadge } from "./desk-charts-BV1SUC0s.mjs";
import { a as listedEquipment, o as piecesForInstall, r as findRecipeFor, s as shortEquipLabel, t as catalogModels } from "./equipment-BqmdRYT6.mjs";
import { n as serializeMachines, t as mergeMachineSpecs } from "./machines-Cg3Pndmv.mjs";
import { a as Thread, i as DialogTitle, n as DialogContent, t as Dialog } from "./thread-BhKV-CeC.mjs";
import { n as EquipmentCombo, r as EquipmentMultiCombo, t as CustomerCombo } from "./directory-fields-Bs08Xp2k.mjs";
import { n as previewSetting, t as RecipeForm } from "./recipe-form-CfWtj2kp.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/entity-sheets-Cr2nNM9k.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function RecipeEditorSheet({ draft, models, customers, onClose }) {
	const qc = useQueryClient();
	const save = useMutation({
		mutationFn: (d) => upsertRecipe({ data: d }),
		onSuccess: (row) => {
			toast.success(row.customer ? `Saved for ${row.customer}` : "House recipe saved");
			qc.invalidateQueries({ queryKey: ["recipes"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
			onClose();
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Failed")
	});
	const copy = useMutation({
		mutationFn: (d) => copyRecipe({ data: d }),
		onSuccess: (row) => {
			toast.success(`Copied onto ${row.customer}`);
			qc.invalidateQueries({ queryKey: ["recipes"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
			onClose();
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Failed")
	});
	const title = draft?.recipe ? draft.recipe.customer ? `${draft.recipe.customer}` : "House template" : draft?.customer ? draft.customer : "New recipe";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open: !!draft,
		onOpenChange: (o) => !o && onClose(),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, { children: draft ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: "Recipe"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: title }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted-foreground",
				children: draft.equipmentModel || draft.recipe?.equipmentModel || "Pick equipment"
			})
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "p-5",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecipeForm, {
				draft,
				models,
				customers,
				pending: save.isPending,
				copyPending: copy.isPending,
				onSave: (d) => save.mutate(d),
				onCopy: draft.recipe ? (d) => copy.mutate(d) : void 0
			}, `${draft.recipe?.id ?? "new"}-${draft.equipmentModel}-${draft.customer}`)
		})] }) : null })
	});
}
function RecipeChip({ piece, customer, installId, recipes, onOpen, onRemove }) {
	const { linked, house } = findRecipeFor(recipes, {
		customer,
		model: piece.model,
		installId
	});
	const preview = previewSetting(linked ?? void 0);
	let tone = "empty";
	let status = "Add recipe";
	if (linked) {
		tone = "saved";
		status = "Recipe";
	} else if (house) {
		tone = "house";
		status = "House";
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("inline-flex h-9 max-w-[16rem] items-center rounded-md border", tone === "saved" && "border-primary/30 bg-primary/8", tone === "house" && "border-border bg-card", tone === "empty" && "border-dashed border-border bg-background text-muted-foreground"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: (e) => {
				e.stopPropagation();
				onOpen({
					recipe: linked,
					customer,
					equipmentModel: piece.model,
					installId,
					copiedFrom: linked?.copiedFrom ?? house?.id ?? null,
					lockCustomer: true,
					lockEquipment: false,
					source: null
				});
			},
			className: "inline-flex min-w-0 flex-1 items-center gap-1.5 px-2 text-left",
			title: preview ?? `${piece.model} recipe`,
			children: [
				tone === "empty" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5 shrink-0" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, { className: "size-3.5 shrink-0" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "min-w-0 truncate text-xs font-medium text-foreground",
					children: shortEquipLabel(piece.label)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "shrink-0 text-[11px] text-muted-foreground",
					children: status
				})
			]
		}), onRemove ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: "flex size-10 shrink-0 items-center justify-center rounded-r-md border-l border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground",
			"aria-label": `Remove ${piece.label}`,
			title: "Remove this equipment from the install",
			onClick: (e) => {
				e.preventDefault();
				e.stopPropagation();
				onRemove();
			},
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
		}) : null]
	});
}
function InstallRecipeList({ customer, installId, pieces, recipes, onOpen }) {
	if (pieces.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "border-b border-border px-5 py-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: "Recipes"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted-foreground",
				children: "Add equipment on this install and a recipe slot will show up for each machine."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				type: "button",
				size: "sm",
				variant: "outline",
				className: "mt-3",
				onClick: () => onOpen({
					recipe: null,
					customer,
					equipmentModel: "",
					installId,
					copiedFrom: null,
					lockCustomer: true
				}),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }),
					"Add recipe for ",
					customer
				]
			})
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "border-b border-border px-5 py-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: "Recipes by machine"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 text-xs text-muted-foreground",
				children: [
					"Linked to ",
					customer,
					". Shared with techs and sales. Use a house recipe or start a new one."
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 space-y-2",
				children: pieces.map((p, idx) => {
					const { linked, house } = findRecipeFor(recipes, {
						customer,
						model: p.model,
						installId
					});
					const preview = previewSetting(linked ?? house ?? void 0);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex flex-col gap-2 rounded-lg border border-border bg-background px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "truncate text-sm font-medium",
								children: p.model
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "truncate text-xs text-muted-foreground",
								children: [linked ? "Saved for this account" : house ? "House recipe available" : "No recipe yet", preview ? ` · ${preview}` : ""]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							size: "sm",
							variant: linked ? "secondary" : "outline",
							onClick: () => onOpen({
								recipe: linked,
								customer,
								equipmentModel: p.model,
								installId,
								copiedFrom: linked?.copiedFrom ?? house?.id ?? null,
								lockCustomer: true,
								lockEquipment: false,
								source: null
							}),
							children: linked ? "Edit" : "Add recipe"
						})]
					}, `${p.model}-${idx}`);
				})
			})
		]
	});
}
function MachineFields({ specs, onChange }) {
	if (!specs.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "space-y-3",
		children: specs.map((spec, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", {
			className: "rounded-xl border border-border bg-background px-3 py-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
					className: "px-1 text-sm font-medium",
					children: spec.equipment
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: "Serial and power for this machine only — not shared with the others on this install."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2 grid gap-3 sm:grid-cols-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Label, {
						htmlFor: `sn-${index}`,
						children: ["Serial number — ", spec.equipment]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: `sn-${index}`,
						className: "mt-1",
						value: spec.serial,
						autoComplete: "off",
						placeholder: "Type the serial",
						onChange: (e) => {
							onChange(specs.map((s, i) => i === index ? {
								...s,
								serial: e.target.value
							} : s));
						}
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Label, {
						htmlFor: `pwr-${index}`,
						children: ["Power / voltage — ", spec.equipment]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: `pwr-${index}`,
						className: "mt-1",
						value: spec.powerVoltage,
						autoComplete: "off",
						placeholder: "e.g. 208V / 1-phase / 30A",
						onChange: (e) => {
							onChange(specs.map((s, i) => i === index ? {
								...s,
								powerVoltage: e.target.value
							} : s));
						}
					})] })]
				})
			]
		}, `${spec.equipment}-${index}`))
	});
}
function Field({ label, name, defaultValue, type = "text", placeholder }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
		htmlFor: name,
		children: label
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
		id: name,
		name,
		type,
		defaultValue,
		placeholder,
		autoComplete: "off",
		className: "mt-1"
	})] });
}
function BoundCustomer({ recordKey, defaultValue, name = "customer", required }) {
	const [value, setValue] = (0, import_react.useState)(defaultValue);
	(0, import_react.useEffect)(() => {
		setValue(defaultValue);
	}, [recordKey, defaultValue]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
		name,
		value,
		onChange: setValue,
		required
	});
}
function BoundEquipment({ recordKey, defaultValue, name = "equipment" }) {
	const [value, setValue] = (0, import_react.useState)(defaultValue);
	(0, import_react.useEffect)(() => {
		setValue(defaultValue);
	}, [recordKey, defaultValue]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentCombo, {
		name,
		value,
		onChange: setValue
	});
}
function PmSheet({ pm, onClose }) {
	const qc = useQueryClient();
	const save = useMutation({
		mutationFn: (d) => updatePm({ data: d }),
		onSuccess: () => {
			toast.success("Saved");
			qc.invalidateQueries({ queryKey: ["pms"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open: !!pm,
		onOpenChange: (o) => !o && onClose(),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, { children: pm ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-wide text-muted-foreground uppercase",
					children: "Preventative maintenance"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: pm.customer }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2 flex flex-wrap gap-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: pm.status }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagBadge, { flag: pm.flag })]
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "grid gap-3 border-b border-border p-5 sm:grid-cols-2",
				onSubmit: (e) => {
					e.preventDefault();
					const fd = new FormData(e.currentTarget);
					save.mutate({
						id: pm.id,
						customer: String(fd.get("customer")),
						equipment: String(fd.get("equipment") || "") || null,
						style: String(fd.get("style") || "") || null,
						projected: String(fd.get("projected") || "") || null,
						partsStatus: String(fd.get("partsStatus") || "") || null,
						status: String(fd.get("status")),
						technician: String(fd.get("technician") || "") || null,
						notes: String(fd.get("notes") || "") || null
					});
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BoundCustomer, {
						recordKey: pm.id,
						defaultValue: pm.customer,
						required: true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BoundEquipment, {
						recordKey: pm.id,
						defaultValue: pm.equipment ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "PM style" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "style",
						className: "mt-1",
						defaultValue: pm.style ?? "",
						allowEmpty: true,
						children: PM_STYLES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Status" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "status",
						className: "mt-1",
						defaultValue: pm.status,
						children: PM_STATUSES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Projected date",
						name: "projected",
						type: "date",
						defaultValue: pm.projected ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Parts" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "partsStatus",
						className: "mt-1",
						defaultValue: pm.partsStatus ?? "",
						allowEmpty: true,
						children: PARTS_STATUSES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Tech" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "technician",
						className: "mt-1",
						defaultValue: pm.technician ?? "",
						allowEmpty: true,
						children: TECHNICIANS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Notes" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							name: "notes",
							className: "mt-1",
							defaultValue: pm.notes ?? ""
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex justify-end sm:col-span-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							size: "sm",
							disabled: save.isPending,
							children: "Save"
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Thread, {
				entityType: "pm",
				entityId: pm.id
			})
		] }) : null })
	});
}
function InstallSheet({ row, onClose }) {
	const qc = useQueryClient();
	const recs = useQuery({
		queryKey: ["recipes"],
		queryFn: () => listRecipes()
	});
	const assets = useQuery({
		queryKey: ["assets"],
		queryFn: () => listAssets()
	});
	const customers = useQuery({
		queryKey: ["customers"],
		queryFn: () => listCustomers()
	});
	const directoryEquip = useQuery({
		queryKey: ["directory", "equipment"],
		queryFn: () => listDirectory({ data: { kind: "equipment" } })
	});
	const [recipeDraft, setRecipeDraft] = (0, import_react.useState)(null);
	const [customer, setCustomer] = (0, import_react.useState)(row?.customer ?? "");
	const [equipPieces, setEquipPieces] = (0, import_react.useState)([]);
	const [specs, setSpecs] = (0, import_react.useState)([]);
	const [hydratedId, setHydratedId] = (0, import_react.useState)(null);
	const catalog = catalogModels([
		...(directoryEquip.data ?? []).map((e) => e.name),
		...(assets.data ?? []).filter((a) => a.kind === "equip").map((a) => a.model),
		...(recs.data ?? []).map((r) => r.equipmentModel)
	]);
	(0, import_react.useEffect)(() => {
		setRecipeDraft(null);
		setCustomer(row?.customer ?? "");
		const saved = row?.machines ?? [];
		const names = saved.length ? saved.map((s) => s.equipment) : listedEquipment(row?.equipment, catalog);
		setEquipPieces(names);
		setSpecs(saved.length ? saved : mergeMachineSpecs(names, [], {
			serial: row?.serial,
			powerVoltage: row?.powerVoltage
		}));
		setHydratedId(row?.id ?? null);
	}, [row?.id]);
	const save = useMutation({
		mutationFn: (d) => updateInstall({ data: d }),
		onSuccess: (_row, vars) => {
			if (!Object.keys(vars).filter((k) => k !== "id").every((k) => [
				"equipment",
				"serial",
				"powerVoltage",
				"machines"
			].includes(k))) toast.success("Saved");
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save")
	});
	const saveRecipe = useMutation({
		mutationFn: (d) => upsertRecipe({ data: d }),
		onSuccess: (saved) => {
			toast.success(saved.customer ? `Recipe saved for ${saved.customer}` : "House recipe saved");
			qc.invalidateQueries({ queryKey: ["recipes"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
			setRecipeDraft(null);
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Failed")
	});
	const copy = useMutation({
		mutationFn: (d) => copyRecipe({ data: d }),
		onSuccess: (saved) => {
			toast.success(`Copied onto ${saved.customer}`);
			qc.invalidateQueries({ queryKey: ["recipes"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
			setRecipeDraft(null);
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Failed")
	});
	const pieces = row ? piecesForInstall(row.equipment, row.customer, row.id, catalog, recs.data ?? []) : [];
	const models = catalog;
	function persistMachines(next) {
		setSpecs(next);
		setEquipPieces(next.map((s) => s.equipment));
		if (!row) return;
		const packed = serializeMachines(next);
		save.mutate({
			id: row.id,
			equipment: packed.equipment,
			serial: packed.serial,
			powerVoltage: packed.powerVoltage,
			machines: packed.machines
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open: !!row,
		onOpenChange: (o) => {
			if (!o) {
				if (row && hydratedId === row.id) {
					const packed = serializeMachines(specs);
					save.mutate({
						id: row.id,
						equipment: packed.equipment,
						serial: packed.serial,
						powerVoltage: packed.powerVoltage,
						machines: packed.machines
					});
				}
				setRecipeDraft(null);
				onClose();
			}
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, { children: row ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-wide text-muted-foreground uppercase",
					children: "Install"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: row.customer }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2 flex flex-wrap gap-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: row.equipStatus }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagBadge, { flag: row.flag })]
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InstallAssets, { installId: row.id }),
			recipeDraft ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-b border-border p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-3 flex items-center justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs tracking-wide text-muted-foreground uppercase",
						children: "Recipe"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						size: "sm",
						variant: "ghost",
						onClick: () => setRecipeDraft(null),
						children: "Back to machines"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecipeForm, {
					draft: recipeDraft,
					models,
					customers: customers.data ?? [],
					pending: saveRecipe.isPending,
					copyPending: copy.isPending,
					onSave: (d) => saveRecipe.mutate(d),
					onCopy: recipeDraft.recipe ? (d) => copy.mutate(d) : void 0
				}, `${recipeDraft.recipe?.id ?? "new"}-${recipeDraft.equipmentModel}`)]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InstallRecipeList, {
				customer: row.customer,
				installId: row.id,
				pieces,
				recipes: recs.data ?? [],
				onOpen: setRecipeDraft
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "grid gap-3 border-b border-border p-5 sm:grid-cols-2",
				onSubmit: (e) => {
					e.preventDefault();
					const fd = new FormData(e.currentTarget);
					const packed = serializeMachines(specs);
					save.mutate({
						id: row.id,
						customer: String(fd.get("customer")),
						equipment: packed.equipment,
						equipStatus: String(fd.get("equipStatus") || "") || null,
						installDate: String(fd.get("installDate") || "") || null,
						technician: String(fd.get("technician") || "") || null,
						wo: String(fd.get("wo") || "") || null,
						reqsReady: String(fd.get("reqsReady") || "") || null,
						notes: String(fd.get("notes") || "") || null,
						accountRep: String(fd.get("accountRep") || "") || null,
						paymentStatus: String(fd.get("paymentStatus") || "") || null,
						serial: packed.serial,
						powerVoltage: packed.powerVoltage,
						machines: packed.machines
					});
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
						name: "customer",
						value: customer,
						onChange: setCustomer,
						required: true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentMultiCombo, {
							values: equipPieces,
							placeholder: "Search the full equipment list…",
							onChange: (next) => persistMachines(mergeMachineSpecs(next, specs))
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-muted-foreground",
							children: "Scroll the full list, pick a model, or type a new one to add it."
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "sm:col-span-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MachineFields, {
							specs,
							onChange: setSpecs
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Equipment status" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "equipStatus",
						className: "mt-1",
						defaultValue: row.equipStatus ?? "",
						allowEmpty: true,
						children: EQUIP_STATUSES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Install date",
						name: "installDate",
						type: "date",
						defaultValue: row.installDate ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Tech" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "technician",
						className: "mt-1",
						defaultValue: row.technician ?? "",
						allowEmpty: true,
						children: TECHNICIANS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "WO #",
						name: "wo",
						defaultValue: row.wo ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Site ready?" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "reqsReady",
						className: "mt-1",
						defaultValue: row.reqsReady ?? "",
						allowEmpty: true,
						children: REQS_READY.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Account rep",
						name: "accountRep",
						defaultValue: row.accountRep ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Payment" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "paymentStatus",
						className: "mt-1",
						defaultValue: row.paymentStatus ?? "",
						allowEmpty: true,
						children: PAYMENT_TERMS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Notes" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							name: "notes",
							className: "mt-1",
							defaultValue: row.notes ?? ""
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex justify-end sm:col-span-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							size: "sm",
							disabled: save.isPending,
							children: "Save"
						})
					})
				]
			}, row.id),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Thread, {
				entityType: "install",
				entityId: row.id
			})
		] }) : null })
	});
}
function DealSheet({ deal, onClose }) {
	const qc = useQueryClient();
	const save = useMutation({
		mutationFn: (d) => updateDeal({ data: d }),
		onSuccess: () => {
			toast.success("Saved");
			qc.invalidateQueries({ queryKey: ["deals"] });
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["handoff"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open: !!deal,
		onOpenChange: (o) => !o && onClose(),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, { children: deal ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs tracking-wide text-muted-foreground uppercase",
					children: ["Pipeline · ", moneyExact(deal.amount)]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: deal.customer }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-2 flex flex-wrap gap-1.5",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: deal.completion === "complete" ? "Complete" : deal.completion === "fell" ? "Fell through" : "Open" })
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "grid gap-3 border-b border-border p-5 sm:grid-cols-2",
				onSubmit: (e) => {
					e.preventDefault();
					const fd = new FormData(e.currentTarget);
					const amountRaw = String(fd.get("amount") || "").replace(/[$,]/g, "").trim();
					const amountNum = amountRaw ? Number(amountRaw) : NaN;
					save.mutate({
						id: deal.id,
						customer: String(fd.get("customer")),
						producer: String(fd.get("producer") || "") || null,
						equipment: String(fd.get("equipment") || "") || null,
						amount: Number.isFinite(amountNum) ? amountNum : null,
						goodToOrder: fd.get("goodToOrder") === "on",
						ordered: fd.get("ordered") === "on",
						eta: String(fd.get("eta") || "") || null,
						terms: String(fd.get("terms") || "") || null,
						invoice: String(fd.get("invoice") || "") || null,
						completion: String(fd.get("completion") || "") || null,
						notes: String(fd.get("notes") || "") || null
					});
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BoundCustomer, {
						recordKey: deal.id,
						defaultValue: deal.customer,
						required: true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Producer" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
						name: "producer",
						className: "mt-1",
						defaultValue: deal.producer ?? "",
						allowEmpty: true,
						children: [deal.producer && !PRODUCERS.includes(deal.producer) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: deal.producer }, deal.producer) : null, PRODUCERS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))]
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "sm:col-span-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BoundEquipment, {
							recordKey: deal.id,
							defaultValue: deal.equipment ?? ""
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Amount",
						name: "amount",
						defaultValue: deal.amount != null ? String(deal.amount) : ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Payment terms" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "terms",
						className: "mt-1",
						defaultValue: deal.terms ?? "",
						allowEmpty: true,
						children: PAYMENT_TERMS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "ETA",
						name: "eta",
						defaultValue: deal.eta ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Invoice #",
						name: "invoice",
						defaultValue: deal.invoice ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Deal completion" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
						name: "completion",
						className: "mt-1",
						defaultValue: deal.completion ?? "",
						allowEmpty: true,
						emptyLabel: "Still open",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "complete",
							children: "Complete — hand off to service"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "fell",
							children: "Fell through"
						})]
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex items-center gap-2 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							name: "goodToOrder",
							defaultChecked: deal.goodToOrder
						}), "Good to order"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex items-center gap-2 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							name: "ordered",
							defaultChecked: deal.ordered
						}), "Equipment ordered"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Notes" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							name: "notes",
							className: "mt-1",
							defaultValue: deal.notes ?? ""
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex justify-end sm:col-span-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							size: "sm",
							disabled: save.isPending,
							children: "Save"
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Thread, {
				entityType: "deal",
				entityId: deal.id
			})
		] }) : null })
	});
}
function ModuleSheet({ row, onClose }) {
	const qc = useQueryClient();
	const save = useMutation({
		mutationFn: (d) => updateModule({ data: d }),
		onSuccess: () => {
			toast.success("Saved");
			qc.invalidateQueries({ queryKey: ["modules"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open: !!row,
		onOpenChange: (o) => !o && onClose(),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, { children: row ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-wide text-muted-foreground uppercase",
					children: "Eversys module"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: row.moduleId }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: row.status })
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "grid gap-3 border-b border-border p-5 sm:grid-cols-2",
				onSubmit: (e) => {
					e.preventDefault();
					const fd = new FormData(e.currentTarget);
					save.mutate({
						id: row.id,
						platform: String(fd.get("platform") || "") || null,
						moduleType: String(fd.get("moduleType") || "") || null,
						status: String(fd.get("status")),
						wo: String(fd.get("wo") || "") || null,
						location: String(fd.get("location") || "") || null,
						dateIn: String(fd.get("dateIn") || "") || null,
						dateReady: String(fd.get("dateReady") || "") || null,
						technician: String(fd.get("technician") || "") || null,
						notes: String(fd.get("notes") || "") || null
					});
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Platform" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "platform",
						className: "mt-1",
						defaultValue: row.platform ?? "",
						children: MODULE_PLATFORMS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Type" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "moduleType",
						className: "mt-1",
						defaultValue: row.moduleType ?? "",
						children: MODULE_TYPES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Status" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "status",
						className: "mt-1",
						defaultValue: row.status,
						children: MODULE_STATUSES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Location / account",
						name: "location",
						defaultValue: row.location ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "WO #",
						name: "wo",
						defaultValue: row.wo ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Tech" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "technician",
						className: "mt-1",
						defaultValue: row.technician ?? "",
						allowEmpty: true,
						children: TECHNICIANS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Date in",
						name: "dateIn",
						type: "date",
						defaultValue: row.dateIn ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Date ready",
						name: "dateReady",
						type: "date",
						defaultValue: row.dateReady ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Notes" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							name: "notes",
							className: "mt-1",
							defaultValue: row.notes ?? ""
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex justify-end sm:col-span-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							size: "sm",
							disabled: save.isPending,
							children: "Save"
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Thread, {
				entityType: "module",
				entityId: row.id
			})
		] }) : null })
	});
}
function InstallAssets({ installId }) {
	const qc = useQueryClient();
	const assets = useQuery({
		queryKey: ["assets"],
		queryFn: () => listAssets()
	});
	const [pick, setPick] = (0, import_react.useState)("");
	const [q, setQ] = (0, import_react.useState)("");
	const assigned = (assets.data ?? []).filter((a) => a.installId === installId);
	const pool = filterReadyUnits((assets.data ?? []).filter((a) => a.status === "ready" && a.site.startsWith("barn")), q);
	const assign = useMutation({
		mutationFn: (assetId) => assignAssetToInstall({ data: {
			assetId,
			installId
		} }),
		onSuccess: () => {
			toast.success("Pulled from the barn — off the warehouse board");
			setPick("");
			qc.invalidateQueries({ queryKey: ["assets"] });
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Failed")
	});
	const unassign = useMutation({
		mutationFn: (assetId) => unassignAssetFromInstall({ data: {
			assetId,
			installId
		} }),
		onSuccess: () => {
			toast.success("Removed — back on the barn rack");
			qc.invalidateQueries({ queryKey: ["assets"] });
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Failed")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		id: "warehouse-units",
		className: "border-b border-border bg-muted/40 p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: "Warehouse units"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-0.5 text-xs text-muted-foreground",
				children: "Assigning a unit takes it off the rack. Serial and voltage on this install stay blank until you type them."
			}),
			assets.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted-foreground",
				children: "Loading the barn…"
			}) : assigned.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-2 space-y-1",
				children: assigned.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center justify-between gap-2 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "min-w-0 truncate",
						children: [
							a.model,
							" · ",
							a.serial ?? "no serial",
							a.customerOwned ? ` · ${a.customerOwned}` : ""
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-background hover:text-foreground",
						"aria-label": `Remove ${a.model}`,
						disabled: unassign.isPending,
						onClick: () => unassign.mutate(a.id),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" }), "Remove"]
					})]
				}, a.id))
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted-foreground",
				children: "None pulled yet. Assigning a unit removes it from the barn rack."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				value: q,
				onChange: (e) => setQ(e.target.value),
				placeholder: "Filter by model or serial…",
				className: "mt-3",
				"aria-label": "Filter warehouse units"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1.5 text-xs text-muted-foreground",
				children: [pool.length, " ready on the rack"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex flex-col gap-2 sm:flex-row",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
					className: "flex-1",
					value: pick,
					onChange: (e) => setPick(e.target.value),
					allowEmpty: true,
					emptyLabel: "Ready unit on the rack…",
					"aria-label": "Ready unit on the rack",
					children: pool.slice(0, 120).map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
						value: a.id,
						children: [
							a.model,
							" · ",
							a.slotLabel,
							a.serial ? ` · ${a.serial}` : ""
						]
					}, a.id))
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					type: "button",
					disabled: !pick || assign.isPending,
					onClick: () => assign.mutate(Number(pick)),
					children: "Assign from barn"
				})]
			})
		]
	});
}
function filterReadyUnits(ready, filter) {
	const q = filter.trim().toLowerCase();
	return [...q ? ready.filter((a) => `${a.model} ${a.serial ?? ""} ${a.slotLabel}`.toLowerCase().includes(q)) : ready].sort((a, b) => a.model.localeCompare(b.model) || a.slotLabel.localeCompare(b.slotLabel));
}
function SimpleCreateDialog({ title, open, onOpenChange, fields, onSubmit }) {
	const [pending, setPending] = (0, import_react.useState)(false);
	const [values, setValues] = (0, import_react.useState)({});
	(0, import_react.useEffect)(() => {
		if (open) setValues({});
	}, [open]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: title }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "mt-4 space-y-3",
			onSubmit: async (e) => {
				e.preventDefault();
				const fd = new FormData(e.currentTarget);
				const next = { ...values };
				for (const [k, v] of fd.entries()) next[k] = String(v);
				setPending(true);
				try {
					await onSubmit(next);
					onOpenChange(false);
				} catch (err) {
					toast.error(err instanceof Error ? err.message : "Failed");
				} finally {
					setPending(false);
				}
			},
			children: [fields.map((f) => {
				const val = values[f.name] ?? "";
				if (f.kind === "customer") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
					name: f.name,
					label: f.label,
					value: val,
					onChange: (v) => setValues((cur) => ({
						...cur,
						[f.name]: v
					})),
					required: f.required
				}, f.name);
				if (f.kind === "equipment") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentCombo, {
					name: f.name,
					label: f.label,
					value: val,
					onChange: (v) => setValues((cur) => ({
						...cur,
						[f.name]: v
					}))
				}, f.name);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: f.name,
					children: f.label
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					id: f.name,
					name: f.name,
					className: "mt-1",
					required: f.required
				})] }, f.name);
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex justify-end",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					disabled: pending,
					children: "Create"
				})
			})]
		})] })
	});
}
//#endregion
export { PmSheet as a, SimpleCreateDialog as c, ModuleSheet as i, InstallSheet as n, RecipeChip as o, MachineFields as r, RecipeEditorSheet as s, DealSheet as t };
