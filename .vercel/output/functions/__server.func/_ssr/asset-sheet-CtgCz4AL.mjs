import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Button } from "./button-6ZsGYj3J.mjs";
import { F as updateAsset, M as returnAssetToWarehouse, k as markAssetSold, s as assignAssetToInstall, w as listInstalls } from "./api-B23zb1CT.mjs";
import { i as SheetTitle, n as SheetContent, r as SheetHeader, t as Sheet } from "./sheet-CqTk9YRH.mjs";
import { l as SelectField } from "./sort-C5YlOVRH.mjs";
import { n as Label, r as Textarea, t as Input } from "./input-D-eo25vp.mjs";
import { c as StatusBadge } from "./desk-charts-BV1SUC0s.mjs";
import { c as bayFor, i as LEVELS, o as SITE_LABEL, r as FRONT_PALLETS, t as BACK_PALLETS } from "./warehouse-D56k1KJf.mjs";
import { a as Thread } from "./thread-BhKV-CeC.mjs";
import { n as EquipmentCombo, t as CustomerCombo } from "./directory-fields-Bs08Xp2k.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/asset-sheet-CtgCz4AL.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function AssetSheet({ asset, onClose }) {
	const qc = useQueryClient();
	const installs = useQuery({
		queryKey: ["installs"],
		queryFn: () => listInstalls(),
		enabled: !!asset
	});
	const [soldTo, setSoldTo] = (0, import_react.useState)("");
	const [model, setModel] = (0, import_react.useState)(asset?.model ?? "");
	const [owned, setOwned] = (0, import_react.useState)(asset?.customerOwned ?? "");
	const [retSite, setRetSite] = (0, import_react.useState)("barn-back");
	const [retPallet, setRetPallet] = (0, import_react.useState)("H");
	const [retLevel, setRetLevel] = (0, import_react.useState)(1);
	const [installId, setInstallId] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		setModel(asset?.model ?? "");
		setOwned(asset?.customerOwned ?? "");
		setSoldTo(asset?.soldTo ?? "");
	}, [asset?.id]);
	const save = useMutation({
		mutationFn: (d) => updateAsset({ data: d }),
		onSuccess: () => {
			toast.success("Saved");
			qc.invalidateQueries({ queryKey: ["assets"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		}
	});
	const ret = useMutation({
		mutationFn: () => returnAssetToWarehouse({ data: {
			id: asset.id,
			site: retSite,
			pallet: retPallet,
			level: retLevel
		} }),
		onSuccess: () => {
			toast.success("Back on the rack");
			qc.invalidateQueries({ queryKey: ["assets"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["installs"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not return")
	});
	const sold = useMutation({
		mutationFn: () => markAssetSold({ data: {
			id: asset.id,
			soldTo
		} }),
		onSuccess: () => {
			toast.success("Marked sold");
			qc.invalidateQueries({ queryKey: ["assets"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not sell")
	});
	const assign = useMutation({
		mutationFn: () => assignAssetToInstall({ data: {
			assetId: asset.id,
			installId: Number(installId)
		} }),
		onSuccess: () => {
			toast.success("Pulled for install — off the warehouse board");
			qc.invalidateQueries({ queryKey: ["assets"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["installs"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not assign")
	});
	const queue = (installs.data ?? []).filter((i) => !i.complete && i.equipStatus !== "Installed");
	const pallets = retSite === "barn-front" ? FRONT_PALLETS : BACK_PALLETS;
	const bay = asset ? bayFor(asset.site, asset.pallet) : "general";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open: !!asset,
		onOpenChange: (o) => !o && onClose(),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetContent, { children: asset ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs tracking-wide text-muted-foreground uppercase",
					children: [asset.slotLabel, asset.customerOwned ? ` · owned by ${asset.customerOwned}` : ""]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: asset.model }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2 flex flex-wrap gap-1.5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: statusLabel(asset.status) }),
						bay === "catering" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Catering" }) : null,
						bay === "dispenser" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Dispenser" }) : null,
						asset.missingSerial ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Serial missing" }) : null
					]
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "grid gap-3 border-b border-border p-5 sm:grid-cols-2",
				onSubmit: (e) => {
					e.preventDefault();
					const fd = new FormData(e.currentTarget);
					save.mutate({
						id: asset.id,
						model,
						serial: String(fd.get("serial") || "") || null,
						qty: Number(fd.get("qty") || 1),
						customerOwned: owned || null,
						purpose: String(fd.get("purpose") || "") || null,
						notes: String(fd.get("notes") || "") || null
					});
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "sm:col-span-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentCombo, {
							name: "model",
							label: "Model",
							value: model,
							onChange: setModel,
							required: true
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "serial",
						children: "Serial"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "serial",
						name: "serial",
						className: "mt-1",
						defaultValue: asset.serial ?? ""
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "qty",
						children: "Qty"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "qty",
						name: "qty",
						type: "number",
						min: 1,
						className: "mt-1",
						defaultValue: String(asset.qty)
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "sm:col-span-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
							name: "customerOwned",
							label: "Customer-owned (if any)",
							value: owned,
							onChange: setOwned,
							placeholder: "Search customers…"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "purpose",
						children: "Purpose"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "purpose",
						name: "purpose",
						className: "mt-1",
						defaultValue: asset.purpose ?? ""
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "notes",
							children: "Notes"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							id: "notes",
							name: "notes",
							className: "mt-1",
							defaultValue: asset.notes ?? ""
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
			}, asset.id),
			asset.status === "ready" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-3 border-b border-border p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs tracking-wide text-muted-foreground uppercase",
						children: "Pull for an install"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-2 sm:flex-row",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
							className: "flex-1",
							value: installId,
							onChange: (e) => setInstallId(e.target.value),
							allowEmpty: true,
							emptyLabel: "Choose account",
							children: queue.map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
								value: i.id,
								children: [
									i.customer,
									" · ",
									i.equipment ?? "no model"
								]
							}, i.id))
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							disabled: !installId || assign.isPending,
							onClick: () => assign.mutate(),
							children: "Assign & remove from barn"
						})]
					}),
					!asset.customerOwned ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-2 sm:flex-row sm:items-end",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex-1",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
								label: "",
								value: soldTo,
								onChange: setSoldTo,
								placeholder: "Sold to…"
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "outline",
							disabled: !soldTo.trim() || sold.isPending,
							onClick: () => sold.mutate(),
							children: "Mark sold"
						})]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-warning",
						children: "Customer-owned — return, don’t sell."
					})
				]
			}) : asset.status !== "sold" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-3 border-b border-border p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs tracking-wide text-muted-foreground uppercase",
						children: "Return to barn"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground",
						children: asset.status === "assigned" ? `Out on ${asset.soldTo ?? "an install"}. Put it back on a slot to free the account.` : `Currently at ${SITE_LABEL[asset.site] ?? asset.site}.`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-3 gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
								value: retSite,
								onChange: (e) => {
									const s = e.target.value;
									setRetSite(s);
									setRetPallet(s === "barn-front" ? "J" : "H");
								},
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "barn-back",
									children: "Back rack"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "barn-front",
									children: "Front rack"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
								value: retPallet,
								onChange: (e) => setRetPallet(e.target.value),
								children: pallets.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: p }, p))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
								value: String(retLevel),
								onChange: (e) => setRetLevel(Number(e.target.value)),
								children: LEVELS.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
									value: l,
									children: ["L", l]
								}, l))
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							onClick: () => ret.mutate(),
							disabled: ret.isPending,
							children: "Return to warehouse"
						}), !asset.customerOwned ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "outline",
							disabled: !soldTo.trim() || sold.isPending,
							onClick: () => sold.mutate(),
							children: "Mark sold"
						}) : null]
					}),
					!asset.customerOwned ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						placeholder: "Sold to…",
						value: soldTo,
						onChange: (e) => setSoldTo(e.target.value)
					}) : null
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "border-b border-border px-5 py-4 text-sm text-muted-foreground",
				children: [
					"Sold to ",
					asset.soldTo ?? "—",
					" ",
					asset.soldAt ? `on ${asset.soldAt}` : "",
					"."
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Thread, {
				entityType: "asset",
				entityId: asset.id
			})
		] }) : null })
	});
}
function statusLabel(s) {
	if (s === "ready") return "Ready";
	if (s === "deployed") return "In use";
	if (s === "assigned") return "On an install";
	if (s === "sold") return "Sold";
	return s;
}
//#endregion
export { AssetSheet as t };
