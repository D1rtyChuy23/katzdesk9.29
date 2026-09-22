import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { o as formatShortDate, p as todayChicago, t as addDays } from "./clock-CSFAgASg.mjs";
import { H as ChevronLeft, V as ChevronRight, b as Plus } from "../_libs/lucide-react.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { _ as cn, g as useMyView, h as MyViewBar, o as Route$6, x as useOpenRecord } from "./router-1NWxggZt.mjs";
import { t as OpenLink } from "./open-link-oQ0V2s2m.mjs";
import { t as Skeleton } from "./separator-AdNvdRLl.mjs";
import { t as SelectField } from "./select-field-BxGIjVBi.mjs";
import { t as Badge } from "./badge-C8SL_nG4.mjs";
import { r as StatusBadge } from "./flag-badge-jup2uYzS.mjs";
import { a as Textarea, i as Label, n as Button, r as Input } from "./input-COYCsX_T.mjs";
import { r as PingButton } from "./ping-button-B3Neap2C.mjs";
import { o as StatCard } from "./desk-charts-BMK8dv-e.mjs";
import { a as SheetTitle, i as SheetHeader, n as SheetBody, r as SheetContent, t as Sheet } from "./sheet-CdZCIXqJ.mjs";
import { i as DialogTitle, n as DialogContent, r as DialogDescription, t as Dialog } from "./dialog-zUw3eso-.mjs";
import { a as REBUILD_STATUSES, d as priorityLabel, i as REBUILD_PRIORITIES, n as HEALTH_LABEL, o as SHOP_ACCOUNT, s as WAITING_REASONS } from "./rebuild-model-DW2rlokp.mjs";
import { t as ExportButton } from "./export-dialog-BGDRoctb.mjs";
import { n as CustomerCombo, r as EquipmentCombo } from "./directory-fields-BvcLee-k.mjs";
import { t as Thread } from "./thread-y3SErmOf.mjs";
import { t as SerialNoticeBanner } from "./serial-notice-DcwWIrgz.mjs";
import { createRebuild, listRebuildLinks, listRebuildOwners, listRebuilds, pullRebuildSerial, updateRebuild } from "./rebuilds-C-RRmTb-.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/rebuilds-n4q2nq-p.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function HealthBadge$1({ health }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: health === "overdue" ? "danger" : health === "at-risk" || health === "no-date" ? "warn" : health === "done" ? "outline" : "success",
		children: HEALTH_LABEL[health]
	});
}
function RebuildBoard({ rows, canEdit, onOpen }) {
	const qc = useQueryClient();
	const [dragId, setDragId] = (0, import_react.useState)(null);
	const save = useMutation({
		mutationFn: (d) => updateRebuild({ data: d }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["rebuilds"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not move")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-w-0 gap-3 overflow-x-auto pb-2",
		children: REBUILD_STATUSES.map((status) => {
			const cards = rows.filter((r) => r.status === status);
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: cn("flex w-64 shrink-0 flex-col rounded-xl border border-border bg-muted/40", dragId != null && "ring-1 ring-primary/20"),
				onDragOver: (e) => {
					if (!canEdit) return;
					e.preventDefault();
				},
				onDrop: (e) => {
					e.preventDefault();
					if (!canEdit || dragId == null) return;
					const row = rows.find((r) => r.id === dragId);
					if (!row || row.status === status) {
						setDragId(null);
						return;
					}
					if (status === "Waiting" && !row.reasonCode) {
						toast.message("Waiting needs a reason delayed. Open the card to add one.");
						onOpen(row.id);
						setDragId(null);
						return;
					}
					if (row.status === "Queued" && (!row.owner || !row.targetComplete)) {
						toast.message("Assign an owner and a target complete date before leaving Queued.");
						onOpen(row.id);
						setDragId(null);
						return;
					}
					save.mutate({
						id: dragId,
						status
					});
					setDragId(null);
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "flex items-baseline justify-between gap-2 px-3 py-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-sm font-medium",
						children: status
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "tabular text-xs text-muted-foreground",
						children: cards.length
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "flex flex-1 flex-col gap-2 px-2 pb-2",
					children: cards.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground",
						children: "Empty"
					}) : cards.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						draggable: canEdit,
						onDragStart: () => setDragId(r.id),
						onDragEnd: () => setDragId(null),
						onClick: () => onOpen(r.id),
						className: cn("w-full rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/40", r.health === "overdue" && "border-destructive/40", r.health === "at-risk" && "border-warning/40", r.health === "no-date" && "border-warning/30"),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-medium leading-snug",
								children: r.title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-0.5 truncate text-xs text-muted-foreground",
								children: [
									r.equipment || "No equipment",
									" · ",
									r.account
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2 flex flex-wrap items-center gap-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HealthBadge$1, { health: r.health }), r.status === "Waiting" && r.reasonCode ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									variant: "warn",
									children: r.reasonCode
								}) : null]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-2 text-xs text-muted-foreground",
								children: [r.owner || "No owner", r.targetComplete ? ` · target ${formatShortDate(r.targetComplete)}` : " · no target"]
							})
						]
					}) }, r.id))
				})]
			}, status);
		})
	});
}
function OwnerSelect({ value, onChange, label = "Owner", id, name, allowEmpty = true, className }) {
	const names = useQuery({
		queryKey: ["rebuild-owners"],
		queryFn: () => listRebuildOwners()
	}).data ?? [];
	const current = value.trim();
	const extra = current && !names.some((n) => n.toLowerCase() === current.toLowerCase()) ? [current] : [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className,
		children: [label ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
			htmlFor: id,
			children: label
		}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
			id,
			name,
			className: label ? "mt-1" : void 0,
			value,
			onChange: (e) => onChange(e.target.value),
			allowEmpty,
			emptyLabel: "—",
			children: [extra.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
				value: n,
				children: n
			}, `extra-${n}`)), names.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
				value: n,
				children: n
			}, n))]
		})]
	});
}
function OwnerFilter({ value, onChange, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OwnerSelect, {
		label: "",
		value,
		onChange,
		allowEmpty: true,
		className
	});
}
var WINDOW = 42;
function barRange(r) {
	const start = r.actualStart || r.plannedStart || r.createdAt.slice(0, 10);
	const end = r.actualComplete || r.targetComplete;
	if (!start && !end) return null;
	if (start && end) return {
		start,
		end: end < start ? start : end
	};
	if (start) return {
		start,
		end: addDays(start, 7)
	};
	return {
		start: end,
		end
	};
}
function RebuildPlanner({ rows, canEdit, onOpen }) {
	const today = todayChicago();
	const [anchor, setAnchor] = (0, import_react.useState)(addDays(today, -7));
	const windowEnd = addDays(anchor, 41);
	const [owner, setOwner] = (0, import_react.useState)("");
	const [health, setHealth] = (0, import_react.useState)("");
	const [account, setAccount] = (0, import_react.useState)("");
	const [equip, setEquip] = (0, import_react.useState)("");
	const qc = useQueryClient();
	const saveDate = useMutation({
		mutationFn: (d) => updateRebuild({ data: d }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["rebuilds"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update date")
	});
	const list = (0, import_react.useMemo)(() => {
		let next = rows.filter((r) => r.status !== "Cancelled");
		if (owner) next = next.filter((r) => (r.owner ?? "").toLowerCase() === owner.toLowerCase());
		if (health) next = next.filter((r) => r.health === health);
		if (account.trim()) {
			const n = account.trim().toLowerCase();
			next = next.filter((r) => r.account.toLowerCase().includes(n));
		}
		if (equip.trim()) {
			const n = equip.trim().toLowerCase();
			next = next.filter((r) => (r.equipment ?? "").toLowerCase().includes(n));
		}
		return next;
	}, [
		rows,
		owner,
		health,
		account,
		equip
	]);
	const ticks = [
		0,
		7,
		14,
		21,
		28,
		35
	].map((d) => addDays(anchor, d));
	function pos(iso) {
		const days = Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${anchor}T00:00:00Z`)) / 864e5);
		return Math.max(0, Math.min(WINDOW, days));
	}
	const weekHits = /* @__PURE__ */ new Map();
	for (const r of list) {
		const range = barRange(r);
		if (!range) continue;
		const s = pos(range.start);
		const e = pos(range.end);
		const startWeek = Math.floor(s / 7);
		const endWeek = Math.floor(Math.max(s, e - .01) / 7);
		for (let w = startWeek; w <= endWeek; w++) {
			const key = `${r.owner || "unassigned"}:${w}`;
			weekHits.set(key, (weekHits.get(key) ?? 0) + 1);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-border bg-card p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-xl",
					children: "Rebuild timeline"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-muted-foreground",
					children: [
						formatShortDate(anchor),
						" – ",
						formatShortDate(windowEnd),
						". Overdue bars read as overdue. Same records as the board."
					]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "outline",
							size: "sm",
							onClick: () => setAnchor(addDays(anchor, -7)),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "size-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "outline",
							size: "sm",
							onClick: () => setAnchor(addDays(today, -7)),
							children: "Today"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "outline",
							size: "sm",
							onClick: () => setAnchor(addDays(anchor, 7)),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4" })
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 grid gap-2 sm:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OwnerFilter, {
						value: owner,
						onChange: setOwner
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						className: "h-10 rounded-md border border-input bg-card px-3 text-sm",
						value: health,
						onChange: (e) => setHealth(e.target.value),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "",
							children: "Any health"
						}), [
							"overdue",
							"at-risk",
							"no-date",
							"on-track",
							"done"
						].map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: h,
							children: HEALTH_LABEL[h]
						}, h))]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: account,
						onChange: (e) => setAccount(e.target.value),
						placeholder: "Account"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: equip,
						onChange: (e) => setEquip(e.target.value),
						placeholder: "Equipment"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 overflow-x-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-[640px]",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-1 grid grid-cols-[11rem_1fr] text-[11px] text-muted-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "relative h-5",
								children: ticks.map((d, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "absolute -translate-x-1/2",
									style: { left: `${i / 6 * 100}%` },
									children: formatShortDate(d)
								}, d))
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "space-y-1.5",
							children: list.map((r) => {
								const range = barRange(r);
								const start = range ? pos(range.start) : 0;
								const end = range ? pos(range.end) : 0;
								const left = start / WINDOW * 100;
								const width = Math.max(2, (Math.max(end, start + 1) - start) / WINDOW * 100);
								const todayLeft = pos(today) / WINDOW * 100;
								const overlap = range && (weekHits.get(`${r.owner || "unassigned"}:${Math.floor(start / 7)}`) ?? 0) > 1;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "grid grid-cols-[11rem_1fr] items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										className: "min-w-0 truncate text-left text-xs hover:underline",
										onClick: () => onOpen(r.id),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-medium",
											children: r.account
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "block truncate text-muted-foreground",
											children: r.equipment || r.title
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "relative h-8 rounded-md bg-muted/60",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "absolute inset-y-0 w-px bg-foreground/40",
											style: { left: `${todayLeft}%` }
										}), range ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => onOpen(r.id),
											title: `${r.title} · ${range.start} → ${range.end}`,
											className: cn("absolute top-1 h-6 rounded-md px-2 text-left text-[10px] leading-6 text-cream", r.health === "overdue" ? "bg-destructive" : r.health === "at-risk" || r.health === "no-date" ? "bg-warning" : "bg-primary", overlap && "ring-2 ring-warning"),
											style: {
												left: `${left}%`,
												width: `${width}%`
											},
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "block truncate",
												children: r.title
											})
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "absolute inset-y-0 left-2 flex items-center text-[10px] text-muted-foreground",
											children: "No dates"
										})]
									})]
								}, r.id);
							})
						}),
						canEdit ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-3 space-y-1",
							children: list.filter((r) => r.status !== "Completed").slice(0, 12).map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex flex-wrap items-center gap-2 text-xs",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "w-40 truncate",
										children: r.title
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										variant: "outline",
										children: HEALTH_LABEL[r.health]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										type: "date",
										className: "h-8 w-40",
										value: r.targetComplete ?? "",
										onChange: (e) => saveDate.mutate({
											id: r.id,
											targetComplete: e.target.value || null
										})
									})
								]
							}, `date-${r.id}`))
						}) : null
					]
				})
			})
		]
	});
}
function HealthBadge({ health }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: health === "overdue" ? "danger" : health === "at-risk" || health === "no-date" ? "warn" : health === "done" ? "outline" : "success",
		children: HEALTH_LABEL[health]
	});
}
function RebuildSheet({ row, canEdit, onClose }) {
	const qc = useQueryClient();
	const [title, setTitle] = (0, import_react.useState)("");
	const [account, setAccount] = (0, import_react.useState)(SHOP_ACCOUNT);
	const [equipment, setEquipment] = (0, import_react.useState)("");
	const [serial, setSerial] = (0, import_react.useState)("");
	const [owner, setOwner] = (0, import_react.useState)("");
	const [status, setStatus] = (0, import_react.useState)("Queued");
	const [reasonCode, setReasonCode] = (0, import_react.useState)("");
	const [reasonDetail, setReasonDetail] = (0, import_react.useState)("");
	const [plannedStart, setPlannedStart] = (0, import_react.useState)("");
	const [targetComplete, setTargetComplete] = (0, import_react.useState)("");
	const [actualStart, setActualStart] = (0, import_react.useState)("");
	const [actualComplete, setActualComplete] = (0, import_react.useState)("");
	const [priority, setPriority] = (0, import_react.useState)("normal");
	const [notes, setNotes] = (0, import_react.useState)("");
	const [installId, setInstallId] = (0, import_react.useState)(null);
	const [jobId, setJobId] = (0, import_react.useState)(null);
	const [reuseNotice, setReuseNotice] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (!row) return;
		setTitle(row.title);
		setAccount(row.account);
		setEquipment(row.equipment ?? "");
		setSerial(row.serial ?? "");
		setOwner(row.owner ?? "");
		setStatus(row.status);
		setReasonCode(row.reasonCode ?? "");
		setReasonDetail(row.reasonDetail ?? "");
		setPlannedStart(row.plannedStart ?? "");
		setTargetComplete(row.targetComplete ?? "");
		setActualStart(row.actualStart ?? "");
		setActualComplete(row.actualComplete ?? "");
		setPriority(row.priority);
		setNotes(row.notes ?? "");
		setInstallId(row.installId);
		setJobId(row.jobId);
	}, [row]);
	const links = useQuery({
		queryKey: ["rebuild-links", account],
		queryFn: () => listRebuildLinks({ data: { account } }),
		enabled: !!row
	});
	const save = useMutation({
		mutationFn: () => updateRebuild({ data: {
			id: row.id,
			title,
			account,
			equipment,
			serial,
			owner,
			status,
			reasonCode,
			reasonDetail,
			plannedStart: plannedStart || null,
			targetComplete: targetComplete || null,
			actualStart: actualStart || null,
			actualComplete: actualComplete || null,
			priority,
			notes,
			installId,
			jobId
		} }),
		onSuccess: () => {
			toast.success("Rebuild saved");
			qc.invalidateQueries({ queryKey: ["rebuilds"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
			qc.invalidateQueries({ queryKey: ["activity"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save")
	});
	const pull = useMutation({
		mutationFn: (opts) => pullRebuildSerial({ data: {
			id: row.id,
			serial,
			confirmReuse: opts.confirmReuse
		} }),
		onSuccess: (next) => {
			setReuseNotice(null);
			setSerial(next.serial ?? "");
			setEquipment(next.equipment ?? equipment);
			toast.success(next.serialNotice || "Serial saved");
			qc.invalidateQueries({ queryKey: ["rebuilds"] });
			qc.invalidateQueries({ queryKey: ["assets"] });
		},
		onError: (e) => {
			const msg = e instanceof Error ? e.message : "Could not check warehouse";
			if (/already assigned/i.test(msg)) setReuseNotice(msg);
			else toast.error(msg);
		}
	});
	if (!row) return null;
	const waiting = status === "Waiting";
	const locked = !canEdit;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open: true,
		onOpenChange: (v) => !v && onClose(),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
			className: "sm:max-w-xl",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, {
						className: "pr-8",
						children: row.title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 flex flex-wrap items-center gap-1.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: row.status }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HealthBadge, { health: row.health }),
							row.priority !== "normal" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								variant: "warn",
								children: priorityLabel(row.priority)
							}) : null
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-xs text-muted-foreground",
						children: [
							row.daysOpen,
							" days open",
							row.daysToTarget != null ? ` · ${row.daysToTarget} days to target` : "",
							row.daysInStatus != null ? ` · ${row.daysInStatus} days in ${row.status}` : "",
							row.daysLateEarly != null ? ` · ${row.daysLateEarly === 0 ? "on time" : row.daysLateEarly > 0 ? `${row.daysLateEarly} days late` : `${-row.daysLateEarly} days early`}` : ""
						]
					})
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SerialNoticeBanner, { notice: row.serialNotice }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetBody, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					className: "space-y-4 px-5 py-4",
					onSubmit: (e) => {
						e.preventDefault();
						if (locked) return;
						save.mutate();
					},
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "rb-title",
							children: "Project name"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "rb-title",
							className: "mt-1",
							value: title,
							onChange: (e) => setTitle(e.target.value),
							disabled: locked,
							required: true
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
							label: "Account",
							value: account,
							onChange: setAccount
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "mt-1 text-xs text-primary underline-offset-2 hover:underline",
							onClick: () => setAccount(SHOP_ACCOUNT),
							disabled: locked,
							children: "Katz shop / stock"
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentCombo, {
							label: "Equipment",
							value: equipment,
							onChange: setEquipment
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "rb-serial",
								children: "Serial"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-1 flex gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "rb-serial",
									value: serial,
									onChange: (e) => setSerial(e.target.value),
									onBlur: () => {
										if (locked || !serial.trim()) return;
										pull.mutate({});
									},
									placeholder: "Type a warehouse serial",
									disabled: locked
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									type: "button",
									variant: "outline",
									disabled: locked || pull.isPending,
									onClick: () => pull.mutate({}),
									children: "Pull"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-muted-foreground",
								children: "Matching a warehouse serial attaches that unit. It does not create a second record."
							})
						] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OwnerSelect, {
							value: owner,
							onChange: setOwner
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-3 sm:grid-cols-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "rb-status",
								children: "Status"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
								id: "rb-status",
								className: "mt-1",
								value: status,
								onChange: (e) => setStatus(e.target.value),
								disabled: locked,
								children: REBUILD_STATUSES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: s,
									children: s
								}, s))
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "rb-priority",
								children: "Priority"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
								id: "rb-priority",
								className: "mt-1",
								value: priority,
								onChange: (e) => setPriority(e.target.value),
								disabled: locked,
								children: REBUILD_PRIORITIES.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: p,
									children: priorityLabel(p)
								}, p))
							})] })]
						}),
						waiting ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-xl border border-warning/40 bg-warning/8 p-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "rb-reason",
									children: "Reason delayed"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
									id: "rb-reason",
									className: "mt-1",
									value: reasonCode,
									onChange: (e) => setReasonCode(e.target.value),
									allowEmpty: true,
									emptyLabel: "Pick a reason",
									disabled: locked,
									children: WAITING_REASONS.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: r,
										children: r
									}, r))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "rb-reason-detail",
									className: "mt-3 block",
									children: "Detail"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "rb-reason-detail",
									className: "mt-1",
									value: reasonDetail,
									onChange: (e) => setReasonDetail(e.target.value),
									placeholder: "Optional, required if Other",
									disabled: locked
								})
							]
						}) : row.reasonCode ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs text-muted-foreground",
							children: ["Last waiting reason (history): ", row.reasonCode]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-3 sm:grid-cols-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "rb-planned",
									children: "Planned start"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "rb-planned",
									type: "date",
									className: "mt-1",
									value: plannedStart,
									onChange: (e) => setPlannedStart(e.target.value),
									disabled: locked
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "rb-target",
									children: "Target complete"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "rb-target",
									type: "date",
									className: "mt-1",
									value: targetComplete,
									onChange: (e) => setTargetComplete(e.target.value),
									disabled: locked
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "rb-astart",
									children: "Actual start"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "rb-astart",
									type: "date",
									className: "mt-1",
									value: actualStart,
									onChange: (e) => setActualStart(e.target.value),
									disabled: locked
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "rb-adone",
									children: "Actual complete"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "rb-adone",
									type: "date",
									className: "mt-1",
									value: actualComplete,
									onChange: (e) => setActualComplete(e.target.value),
									disabled: locked
								})] })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "rb-link",
								children: "Linked ticket / install"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
								id: "rb-link",
								className: "mt-1",
								value: installId ? `install:${installId}` : jobId ? `job:${jobId}` : "",
								onChange: (e) => {
									const v = e.target.value;
									if (v.startsWith("install:")) {
										setInstallId(Number(v.slice(8)));
										setJobId(null);
									} else if (v.startsWith("job:")) {
										setJobId(Number(v.slice(4)));
										setInstallId(null);
									} else {
										setInstallId(null);
										setJobId(null);
									}
								},
								allowEmpty: true,
								emptyLabel: "Not linked — this is its own project",
								disabled: locked,
								children: (links.data ?? []).map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: l.kind === "install" ? `install:${l.id}` : `job:${l.id}`,
									children: l.label
								}, `${l.kind}-${l.id}`))
							}),
							installId ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OpenLink, {
								entityType: "install",
								id: installId,
								className: "mt-1 inline-block text-xs text-primary hover:underline",
								children: "Open linked install"
							}) : null,
							jobId ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OpenLink, {
								entityType: "service",
								id: jobId,
								className: "mt-1 inline-block text-xs text-primary hover:underline",
								children: "Open linked ticket"
							}) : null
						] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "rb-notes",
								children: "Notes"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
								id: "rb-notes",
								className: "mt-1",
								value: notes,
								onChange: (e) => setNotes(e.target.value),
								disabled: locked
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-muted-foreground",
								children: "Rebuild notes stay on this project. They do not overwrite Description of work on a service ticket."
							})
						] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2",
							children: [canEdit ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "submit",
								disabled: save.isPending,
								children: save.isPending ? "Saving…" : "Save"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted-foreground",
								children: "Sales can view this rebuild. Bench status is service-owned."
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PingButton, {
								entityType: "rebuild",
								entityId: row.id,
								contextLabel: `${row.title} · ${row.account}`,
								defaultNote: `${row.title} at ${row.account}`
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs text-muted-foreground",
							children: ["Updated ", formatShortDate(row.updatedAt.slice(0, 10))]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Thread, {
					entityType: "rebuild",
					entityId: row.id
				})] })
			]
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open: !!reuseNotice,
		onOpenChange: (v) => !v && setReuseNotice(null),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Serial already assigned" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: reuseNotice }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					onClick: () => {
						pull.mutate({ confirmReuse: true });
					},
					children: "Reuse on this rebuild"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					variant: "outline",
					onClick: () => setReuseNotice(null),
					children: "Cancel"
				})]
			})
		] })
	})] });
}
var FILTERS = [
	{
		id: "all",
		label: "All"
	},
	{
		id: "overdue",
		label: "Overdue"
	},
	{
		id: "at-risk",
		label: "At risk"
	},
	{
		id: "waiting",
		label: "Waiting"
	},
	{
		id: "no-date",
		label: "No date"
	},
	{
		id: "mine",
		label: "My rebuilds"
	}
];
function Page() {
	const { open } = Route$6.useSearch();
	const qc = useQueryClient();
	const data = useQuery({
		queryKey: ["rebuilds"],
		queryFn: () => listRebuilds()
	});
	const { filterMine, matchMine, board, role } = useMyView();
	const [q, setQ] = (0, import_react.useState)("");
	const [chip, setChip] = (0, import_react.useState)("all");
	const [view, setView] = (0, import_react.useState)(board || role !== "sales" ? "board" : "timeline");
	const [selected, setSelected] = useOpenRecord(open);
	const [create, setCreate] = (0, import_react.useState)(false);
	const rows = data.data?.rows ?? [];
	const canEdit = !!data.data?.canEdit;
	const filtered = (0, import_react.useMemo)(() => {
		let list = rows;
		if (filterMine && role === "sales") list = list.filter((r) => matchMine(r.accountRep, r.owner) || r.aviKatz);
		if (chip === "overdue") list = list.filter((r) => r.health === "overdue");
		if (chip === "at-risk") list = list.filter((r) => r.health === "at-risk");
		if (chip === "waiting") list = list.filter((r) => r.status === "Waiting");
		if (chip === "no-date") list = list.filter((r) => r.health === "no-date");
		if (chip === "mine") list = list.filter((r) => matchMine(r.owner));
		const needle = q.trim().toLowerCase();
		if (needle) list = list.filter((r) => [
			r.title,
			r.account,
			r.equipment,
			r.serial,
			r.owner,
			r.status,
			r.reasonCode
		].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle)));
		return list;
	}, [
		rows,
		filterMine,
		role,
		matchMine,
		chip,
		q
	]);
	const selectedRow = rows.find((r) => r.id === selected) ?? null;
	const overdue = rows.filter((r) => r.health === "overdue").length;
	const atRisk = rows.filter((r) => r.health === "at-risk").length;
	const waiting = rows.filter((r) => r.status === "Waiting").length;
	const noDate = rows.filter((r) => r.health === "no-date").length;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl font-medium tracking-tight",
				children: "In-house rebuilds"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-muted-foreground",
				children: "Shop projects, not field tickets. One owner, planned vs actual, a current blocker, and aging you cannot ignore."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MyViewBar, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExportButton, { defaultType: "rebuilds" }),
					canEdit ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						onClick: () => setCreate(true),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "New rebuild"]
					}) : null
				]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 grid min-w-0 gap-3 sm:grid-cols-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Overdue",
					value: overdue,
					tone: overdue ? "danger" : "ok",
					hint: "Past target, still open"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "At risk",
					value: atRisk,
					tone: atRisk ? "warn" : "ok",
					hint: "Waiting, or target within 3 days"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "Waiting",
					value: waiting,
					hint: "Needs a reason delayed"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
					label: "No date",
					value: noDate,
					tone: noDate ? "warn" : "ok",
					hint: "In progress / waiting / testing with no target"
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 flex flex-wrap items-center gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					className: "max-w-xs",
					value: q,
					onChange: (e) => setQ(e.target.value),
					placeholder: "Search project, account, serial…"
				}),
				FILTERS.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setChip(f.id),
					className: cn("rounded-full border px-3 py-1 text-xs", chip === f.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"),
					children: f.label
				}, f.id)),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ml-auto flex gap-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						size: "sm",
						variant: view === "board" ? "default" : "outline",
						onClick: () => setView("board"),
						children: "Board"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						size: "sm",
						variant: view === "timeline" ? "default" : "outline",
						onClick: () => setView("timeline"),
						children: "Timeline"
					})]
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-5",
			children: data.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-64 w-full" }) : view === "board" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RebuildBoard, {
				rows: filtered,
				canEdit,
				onOpen: setSelected
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RebuildPlanner, {
				rows: filtered,
				canEdit,
				onOpen: setSelected
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RebuildSheet, {
			row: selectedRow,
			canEdit,
			onClose: () => setSelected(null)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CreateRebuildDialog, {
			open: create,
			onOpenChange: setCreate,
			onCreated: (row) => {
				qc.invalidateQueries({ queryKey: ["rebuilds"] });
				qc.invalidateQueries({ queryKey: ["dashboard"] });
				setSelected(row.id);
				setCreate(false);
			}
		})
	] });
}
function CreateRebuildDialog({ open, onOpenChange, onCreated }) {
	const [title, setTitle] = (0, import_react.useState)("");
	const [account, setAccount] = (0, import_react.useState)(SHOP_ACCOUNT);
	const [equipment, setEquipment] = (0, import_react.useState)("");
	const [owner, setOwner] = (0, import_react.useState)("");
	const [status, setStatus] = (0, import_react.useState)("Queued");
	const [reasonCode, setReasonCode] = (0, import_react.useState)("");
	const [reasonDetail, setReasonDetail] = (0, import_react.useState)("");
	const [targetComplete, setTargetComplete] = (0, import_react.useState)("");
	const [plannedStart, setPlannedStart] = (0, import_react.useState)("");
	const [notes, setNotes] = (0, import_react.useState)("");
	const create = useMutation({
		mutationFn: () => createRebuild({ data: {
			title,
			account: account || "Katz shop / stock",
			equipment,
			owner,
			status,
			reasonCode,
			reasonDetail,
			targetComplete: targetComplete || null,
			plannedStart: plannedStart || null,
			notes
		} }),
		onSuccess: (row) => {
			toast.success("Rebuild opened");
			setTitle("");
			setEquipment("");
			setNotes("");
			setStatus("Queued");
			setReasonCode("");
			onCreated(row);
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "max-h-[90vh] overflow-y-auto sm:max-w-lg",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "New rebuild" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-4 space-y-3",
				onSubmit: (e) => {
					e.preventDefault();
					create.mutate();
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "new-rb-title",
						children: "Project name"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "new-rb-title",
						className: "mt-1",
						value: title,
						onChange: (e) => setTitle(e.target.value),
						required: true
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomerCombo, {
						label: "Account",
						value: account,
						onChange: setAccount
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "mt-1 text-xs text-primary underline-offset-2 hover:underline",
						onClick: () => setAccount(SHOP_ACCOUNT),
						children: "Katz shop / stock"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EquipmentCombo, {
						label: "Equipment",
						value: equipment,
						onChange: setEquipment
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OwnerSelect, {
						value: owner,
						onChange: setOwner
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 sm:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "new-rb-status",
							children: "Status"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
							id: "new-rb-status",
							className: "mt-1",
							value: status,
							onChange: (e) => setStatus(e.target.value),
							children: REBUILD_STATUSES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: s,
								children: s
							}, s))
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "new-rb-target",
							children: "Target complete"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "new-rb-target",
							type: "date",
							className: "mt-1",
							value: targetComplete,
							onChange: (e) => setTargetComplete(e.target.value)
						})] })]
					}),
					status === "Waiting" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-xl border border-warning/40 bg-warning/8 p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Reason delayed" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
								className: "mt-1",
								value: reasonCode,
								onChange: (e) => setReasonCode(e.target.value),
								allowEmpty: true,
								emptyLabel: "Pick a reason",
								children: [
									"Parts on order",
									"Parts not available",
									"Waiting on decision",
									"Waiting on customer",
									"Tech / bench unavailable",
									"Scope changed",
									"Found additional failure",
									"Other"
								].map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: r,
									children: r
								}, r))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								className: "mt-2",
								value: reasonDetail,
								onChange: (e) => setReasonDetail(e.target.value),
								placeholder: "Detail (required if Other)"
							})
						]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "new-rb-planned",
						children: "Planned start"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "new-rb-planned",
						type: "date",
						className: "mt-1",
						value: plannedStart,
						onChange: (e) => setPlannedStart(e.target.value)
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "new-rb-notes",
						children: "Notes"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
						id: "new-rb-notes",
						className: "mt-1",
						value: notes,
						onChange: (e) => setNotes(e.target.value)
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						disabled: create.isPending,
						children: create.isPending ? "Opening…" : "Open rebuild"
					})
				]
			})]
		})
	});
}
//#endregion
export { Page as component };
