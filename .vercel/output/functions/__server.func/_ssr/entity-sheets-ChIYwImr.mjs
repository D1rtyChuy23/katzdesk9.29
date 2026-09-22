import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { a as EQUIP_STATUSES, c as MODULE_TYPES, d as PM_STATUSES, f as PM_STYLES, l as PARTS_STATUSES, o as MODULE_PLATFORMS, p as REQS_READY, s as MODULE_STATUSES, u as PAYMENT_TERMS } from "./lookups-BkjR5sto.mjs";
import { u as moneyExact } from "./clock-CSFAgASg.mjs";
import { B as ChevronsUpDown, K as BookOpen, b as Plus, t as X, u as Trash2 } from "../_libs/lucide-react.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { _ as cn } from "./router-1NWxggZt.mjs";
import { B as unassignAssetFromInstall, D as listDirectory, G as updateInstall, J as updatePm, M as listRecipes, S as listAssets, T as listCustomers, W as updateDeal, Y as upsertRecipe, a as archiveInstall, l as copyRecipe, o as assignAssetToInstall, q as updateModule, r as archiveDeal } from "./api-CgwyWugK.mjs";
import { t as SelectField } from "./select-field-BxGIjVBi.mjs";
import { t as Badge } from "./badge-C8SL_nG4.mjs";
import { n as FlagBadge, r as StatusBadge } from "./flag-badge-jup2uYzS.mjs";
import { a as Textarea, i as Label, n as Button, r as Input, t as AutoGrowTextarea } from "./input-COYCsX_T.mjs";
import { t as AkBadge } from "./ak-badge-m29_U4_Z.mjs";
import { a as listedEquipment, r as findRecipeFor, s as piecesForInstall, t as catalogModels, u as shortEquipLabel } from "./equipment-BifqoJpR.mjs";
import { i as previewSetting } from "./recipe-fields-DqZtnvK8.mjs";
import { r as RepSelect } from "./rep-select-BQ75vNDf.mjs";
import { a as SheetTitle, i as SheetHeader, n as SheetBody, r as SheetContent, t as Sheet } from "./sheet-CdZCIXqJ.mjs";
import { i as DialogTitle, n as DialogContent, t as Dialog } from "./dialog-zUw3eso-.mjs";
import { r as TechSelect } from "./tech-select-BqrrlfqA.mjs";
import { r as serializeMachines, t as mergeMachineSpecs } from "./machines-CQiZYEgz.mjs";
import { i as EquipmentMultiCombo, n as CustomerCombo, r as EquipmentCombo } from "./directory-fields-BvcLee-k.mjs";
import { t as Thread } from "./thread-y3SErmOf.mjs";
import { n as SerialPullField, t as SerialNoticeBanner } from "./serial-notice-DcwWIrgz.mjs";
import { t as RecipeForm } from "./recipe-form-BLdODl00.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/entity-sheets-ChIYwImr.js
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
			qc.invalidateQueries({ queryKey: ["customer-history"] });
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
			qc.invalidateQueries({ queryKey: ["customer-history"] });
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
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetBody, {
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
function MachineFields({ specs, onChange, installId, onPulled }) {
	if (!specs.length) return null;
	function patch(index, part) {
		return specs.map((s, i) => i === index ? {
			...s,
			...part
		} : s);
	}
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
					children: "Type a warehouse serial to pull the unit onto this account in one step."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2 grid gap-3 sm:grid-cols-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SerialPullField, {
						label: `Serial number — ${spec.equipment}`,
						value: spec.serial,
						installId,
						machineIndex: index,
						onValue: (serial) => onChange(patch(index, { serial })),
						onPulled: (result) => {
							const next = patch(index, {
								serial: result.serial,
								powerVoltage: spec.powerVoltage || result.powerVoltage || ""
							});
							onChange(next);
							onPulled?.(next, result);
						}
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Label, {
						htmlFor: `pwr-${index}`,
						children: ["Power / voltage — ", spec.equipment]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: `pwr-${index}`,
						className: "mt-1",
						value: spec.powerVoltage,
						autoComplete: "off",
						placeholder: "e.g. 208V / 1-phase / 30A",
						onChange: (e) => onChange(patch(index, { powerVoltage: e.target.value }))
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
	const formRef = (0, import_react.useRef)(null);
	const skipToast = (0, import_react.useRef)(false);
	const save = useMutation({
		mutationFn: (d) => updatePm({ data: d }),
		onSuccess: () => {
			if (!skipToast.current) toast.success("Saved");
			skipToast.current = false;
			qc.invalidateQueries({ queryKey: ["pms"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["customer-history"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open: !!pm,
		onOpenChange: (o) => {
			if (!o) {
				skipToast.current = true;
				formRef.current?.requestSubmit();
				onClose();
			}
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, { children: pm ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: "Preventative maintenance"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: pm.customer }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex flex-wrap gap-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: pm.status }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagBadge, { flag: pm.flag })]
			})
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetBody, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			ref: formRef,
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
					notes: String(fd.get("notes") || "") || null,
					wo: String(fd.get("wo") || "") || null,
					workDone: String(fd.get("workDone") || "") || null,
					completedAt: String(fd.get("completedAt") || "") || null
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
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Tech" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TechSelect, {
					name: "technician",
					defaultValue: pm.technician ?? ""
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "WO #",
					name: "wo",
					defaultValue: pm.wo ?? ""
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Date completed",
					name: "completedAt",
					type: "date",
					defaultValue: pm.completedAt ?? ""
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "sm:col-span-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: `pm-work-${pm.id}`,
						children: "Description of work"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AutoGrowTextarea, {
						id: `pm-work-${pm.id}`,
						name: "workDone",
						className: "mt-1",
						defaultValue: pm.workDone ?? "",
						placeholder: "What was done on site…"
					})]
				}),
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
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Thread, {
			entityType: "pm",
			entityId: pm.id
		})] })] }) : null })
	});
}
function InstallSheet({ row, onClose, onOpenRelated }) {
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
	const formRef = (0, import_react.useRef)(null);
	const skipToast = (0, import_react.useRef)(false);
	const catalog = catalogModels([
		...(directoryEquip.data ?? []).map((e) => e.name),
		...(assets.data ?? []).filter((a) => a.kind === "equip").map((a) => a.model),
		...(recs.data ?? []).map((r) => r.equipmentModel)
	]);
	(0, import_react.useEffect)(() => {
		setRecipeDraft(null);
		setCustomer(row?.customer ?? "");
		const saved = row?.machines ?? [];
		const fromSaved = saved.map((s) => s.equipment).filter(Boolean);
		const names = catalog.length ? listedEquipment(fromSaved.join("\n") || row?.equipment, catalog) : fromSaved.length ? fromSaved : (row?.equipment ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
		setEquipPieces(names);
		setSpecs(mergeMachineSpecs(names, saved, {
			serial: row?.serial,
			powerVoltage: row?.powerVoltage
		}));
		setHydratedId(row?.id ?? null);
	}, [row?.id, catalog.join("\n")]);
	const save = useMutation({
		mutationFn: (d) => updateInstall({ data: d }),
		onSuccess: (_row, vars) => {
			if (!Object.keys(vars).filter((k) => k !== "id").every((k) => [
				"equipment",
				"serial",
				"powerVoltage",
				"machines"
			].includes(k)) && !skipToast.current) toast.success("Saved");
			skipToast.current = false;
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["customer-history"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save")
	});
	const dropInstall = useMutation({
		mutationFn: () => archiveInstall({ data: { id: row.id } }),
		onSuccess: () => {
			toast.success(`Removed ${row?.customer} from the list`);
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
			onClose();
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove")
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
				skipToast.current = true;
				formRef.current?.requestSubmit();
				setRecipeDraft(null);
				onClose();
			}
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, { children: row ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: "Install"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: row.customer }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex flex-wrap gap-1.5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: row.equipStatus }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlagBadge, { flag: row.flag }),
					row.duplicateOf ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						variant: "warn",
						children: "Possible duplicate"
					}) : null
				]
			})
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetBody, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SerialNoticeBanner, { notice: row.serialNotice }),
			row.duplicateOf ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-b border-warning/30 bg-warning/10 px-5 py-3 text-sm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-medium",
						children: "This account already had an install request."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted-foreground",
						children: "Check the earlier one before treating this as a second job — or clear the flag if it’s a new request."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 flex flex-wrap gap-2",
						children: [onOpenRelated ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							size: "sm",
							variant: "outline",
							onClick: () => onOpenRelated(row.duplicateOf),
							children: "Open earlier request"
						}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							size: "sm",
							variant: "ghost",
							onClick: () => save.mutate({
								id: row.id,
								duplicateOf: null
							}),
							children: "Not a duplicate"
						})]
					})
				]
			}) : null,
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
				ref: formRef,
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
						workDone: String(fd.get("workDone") || "") || null,
						completedAt: String(fd.get("completedAt") || "") || null,
						accountRep: String(fd.get("accountRep") || "") || null,
						aviKatz: fd.get("aviKatz") === "on",
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
						onChange: (v) => {
							try {
								setCustomer(v);
							} catch (err) {
								toast.error(err instanceof Error ? err.message : "Could not set customer");
							}
						},
						required: true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentMultiCombo, {
							values: equipPieces,
							placeholder: "Search the full equipment list…",
							onChange: (next) => {
								try {
									persistMachines(mergeMachineSpecs(next, specs));
								} catch (err) {
									toast.error(err instanceof Error ? err.message : "Could not update equipment");
								}
							}
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-muted-foreground",
							children: "Scroll the full list, pick a model, or type a new one to add it."
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "sm:col-span-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MachineFields, {
							specs,
							installId: row.id,
							onChange: setSpecs,
							onPulled: (next) => persistMachines(next)
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
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Tech" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TechSelect, {
						name: "technician",
						defaultValue: row.technician ?? ""
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
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepSelect, {
						name: "accountRep",
						label: "Account rep",
						defaultValue: row.accountRep ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex items-center gap-2 text-sm sm:mt-7",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "checkbox",
								name: "aviKatz",
								className: "size-4 accent-primary",
								defaultChecked: row.aviKatz
							}),
							"Avi Katz account (AK)",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AkBadge, { on: row.aviKatz })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Payment" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
						name: "paymentStatus",
						className: "mt-1",
						defaultValue: row.paymentStatus ?? "",
						allowEmpty: true,
						children: PAYMENT_TERMS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s }, s))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Date completed",
						name: "completedAt",
						type: "date",
						defaultValue: row.completedAt ?? ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: `install-work-${row.id}`,
							children: "Description of work"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AutoGrowTextarea, {
							id: `install-work-${row.id}`,
							name: "workDone",
							className: "mt-1",
							defaultValue: row.workDone ?? "",
							placeholder: "What was done on site…"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Notes" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							name: "notes",
							className: "mt-1",
							defaultValue: row.notes ?? ""
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center justify-between gap-2 sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							size: "sm",
							variant: "outline",
							disabled: dropInstall.isPending,
							onClick: () => {
								if (window.confirm(`Remove “${row.customer}” from the install list?`)) dropInstall.mutate();
							},
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), "Remove from list"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							size: "sm",
							disabled: save.isPending,
							children: "Save"
						})]
					})
				]
			}, row.id),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Thread, {
				entityType: "install",
				entityId: row.id
			})
		] })] }) : null })
	});
}
function DealSheet({ deal, onClose }) {
	const qc = useQueryClient();
	const formRef = (0, import_react.useRef)(null);
	const skipToast = (0, import_react.useRef)(false);
	const save = useMutation({
		mutationFn: (d) => updateDeal({ data: d }),
		onSuccess: () => {
			if (!skipToast.current) toast.success("Saved");
			skipToast.current = false;
			qc.invalidateQueries({ queryKey: ["deals"] });
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["handoff"] });
			qc.invalidateQueries({ queryKey: ["customer-history"] });
			qc.invalidateQueries({ queryKey: ["customers"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save")
	});
	const dropDeal = useMutation({
		mutationFn: () => archiveDeal({ data: { id: deal.id } }),
		onSuccess: () => {
			toast.success(`Removed ${deal?.customer} from the list`);
			qc.invalidateQueries({ queryKey: ["deals"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["handoff"] });
			onClose();
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open: !!deal,
		onOpenChange: (o) => {
			if (!o) {
				skipToast.current = true;
				formRef.current?.requestSubmit();
				onClose();
			}
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, { children: deal ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: ["Pipeline · ", moneyExact(deal.amount)]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: deal.customer }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2 flex flex-wrap gap-1.5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: deal.completion === "complete" ? "Complete" : deal.completion === "fell" ? "Fell through" : "Open" })
			})
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetBody, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			ref: formRef,
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
					aviKatz: fd.get("aviKatz") === "on",
					equipment: String(fd.get("equipment") || "") || null,
					amount: Number.isFinite(amountNum) ? amountNum : null,
					goodToOrder: fd.get("goodToOrder") === "on" || fd.get("ordered") === "on",
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
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepSelect, {
					name: "producer",
					label: "Rep",
					defaultValue: deal.producer ?? ""
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex items-center gap-2 text-sm sm:col-span-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							name: "aviKatz",
							className: "size-4 accent-primary",
							defaultChecked: deal.aviKatz
						}),
						"Avi Katz account (AK)",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AkBadge, { on: deal.aviKatz })
					]
				}),
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
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "sm:col-span-2 rounded-lg border border-border bg-muted/40 p-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm font-medium",
							children: "Order steps"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-muted-foreground",
							children: "Reps mark Good to order. Confirm Ordered and it leaves the Good to order list."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 grid gap-2 sm:grid-cols-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex min-h-11 items-center gap-2 text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "checkbox",
									name: "goodToOrder",
									defaultChecked: deal.goodToOrder || deal.ordered
								}), "1. Good to order"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex min-h-11 items-center gap-2 text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "checkbox",
									name: "ordered",
									defaultChecked: deal.ordered
								}), "2. Ordered"]
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "sm:col-span-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Notes" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
						name: "notes",
						className: "mt-1",
						defaultValue: deal.notes ?? ""
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center justify-between gap-2 sm:col-span-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "button",
						size: "sm",
						variant: "outline",
						disabled: dropDeal.isPending,
						onClick: () => {
							if (window.confirm(`Remove “${deal.customer}” from the pipeline list?`)) dropDeal.mutate();
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" }), "Remove from list"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						size: "sm",
						disabled: save.isPending,
						children: "Save"
					})]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Thread, {
			entityType: "deal",
			entityId: deal.id
		})] })] }) : null })
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
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, { children: row ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: "Eversys module"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: row.moduleId }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: row.status })
			})
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetBody, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
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
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Tech" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TechSelect, {
					name: "technician",
					defaultValue: row.technician ?? ""
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
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Thread, {
			entityType: "module",
			entityId: row.id
		})] })] }) : null })
	});
}
function InstallAssets({ installId }) {
	const qc = useQueryClient();
	const assets = useQuery({
		queryKey: ["assets"],
		queryFn: () => listAssets()
	});
	const [pick, setPick] = (0, import_react.useState)("");
	const assigned = (assets.data ?? []).filter((a) => a.installId === installId);
	const ready = (assets.data ?? []).filter((a) => a.status === "ready" && a.site.startsWith("barn"));
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
				children: "Type a warehouse serial on the machine below to pull it in one step — or assign from the rack here."
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
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-3 text-xs text-muted-foreground",
				children: [ready.length, " ready on the rack"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex flex-col gap-2 sm:flex-row sm:items-end",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "min-w-0 flex-1",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReadyUnitPicker, {
						units: ready,
						value: pick,
						onChange: setPick
					})
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
function unitLabel(a) {
	return `${a.model} · ${a.slotLabel}${a.serial ? ` · ${a.serial}` : ""}`;
}
function ReadyUnitPicker({ units, value, onChange }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [q, setQ] = (0, import_react.useState)("");
	const box = (0, import_react.useRef)(null);
	const query = open ? q : "";
	const matches = (0, import_react.useMemo)(() => filterReadyUnits(units, query), [units, query]);
	const selected = units.find((a) => String(a.id) === value) ?? null;
	const notFound = query.trim().length >= 2 && matches.length === 0;
	(0, import_react.useEffect)(() => {
		if (!open) return;
		function onDoc(e) {
			if (!box.current?.contains(e.target)) {
				setOpen(false);
				setQ("");
			}
		}
		document.addEventListener("mousedown", onDoc);
		return () => document.removeEventListener("mousedown", onDoc);
	}, [open]);
	function pick(id) {
		onChange(id);
		setQ("");
		setOpen(false);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: box,
		className: "relative",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex min-h-11 w-full items-center gap-2 rounded-full border border-input bg-background px-3 text-sm focus-within:ring-2 focus-within:ring-ring",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					value: open ? q : selected ? unitLabel(selected) : "",
					placeholder: "Ready unit on the rack…",
					autoComplete: "off",
					"aria-label": "Ready unit on the rack",
					"aria-expanded": open,
					role: "combobox",
					className: "min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground",
					onChange: (e) => {
						setQ(e.target.value);
						if (!open) setOpen(true);
					},
					onFocus: () => {
						setOpen(true);
						setQ("");
					},
					onKeyDown: (e) => {
						if (e.key === "Escape") setOpen(false);
						if (e.key === "Enter") {
							e.preventDefault();
							if (matches[0]) pick(String(matches[0].id));
						}
					}
				}),
				selected && !open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted",
					"aria-label": "Clear",
					onMouseDown: (e) => {
						e.preventDefault();
						onChange("");
					},
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3.5" })
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronsUpDown, { className: "size-4 shrink-0 text-muted-foreground" })
			]
		}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			"data-combo-popover": "",
			className: "absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-soft",
			children: [notFound ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-2 py-1.5 text-xs text-muted-foreground",
				children: "No unit on the rack matches that search."
			}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "max-h-80 overflow-y-auto py-1",
				role: "listbox",
				children: [matches.map((a) => {
					const active = String(a.id) === value;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						role: "option",
						"aria-selected": active,
						className: active ? "flex min-h-10 w-full items-center px-2 py-1.5 text-left text-sm bg-muted" : "flex min-h-10 w-full items-center px-2 py-1.5 text-left text-sm hover:bg-muted",
						onMouseDown: (e) => {
							e.preventDefault();
							pick(String(a.id));
						},
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "min-w-0 truncate",
							children: unitLabel(a)
						})
					}) }, a.id);
				}), !matches.length && !notFound ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "px-2 py-2 text-xs text-muted-foreground",
					children: "Nothing ready on the rack."
				}) : null]
			})]
		}) : null]
	});
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
				if (f.kind === "rep") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepSelect, {
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
