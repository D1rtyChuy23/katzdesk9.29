import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { r as createServerFn } from "./ssr.mjs";
import { a as EQUIP_STATUSES, d as PM_STATUSES, s as MODULE_STATUSES, t as CALL_STATUSES } from "./lookups-BkjR5sto.mjs";
import { A as boolean, D as _enum, F as object, R as string } from "../_libs/@better-auth/core+[...].mjs";
import { a as deskMiddleware, r as createSsrRpc } from "./access-3Tz151bB.mjs";
import { I as Download, d as Table2, y as Printer } from "../_libs/lucide-react.mjs";
import { t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as SelectField } from "./select-field-BxGIjVBi.mjs";
import { i as Label, n as Button, r as Input } from "./input-COYCsX_T.mjs";
import { i as DialogTitle, n as DialogContent, r as DialogDescription, t as Dialog } from "./dialog-zUw3eso-.mjs";
import { a as REBUILD_STATUSES } from "./rebuild-model-DW2rlokp.mjs";
import { t as TechFilter } from "./tech-select-BqrrlfqA.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/export-dialog-BGDRoctb.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var REPORT_TYPES = [
	"pending",
	"pms",
	"modules",
	"tlc",
	"installs",
	"rebuilds"
];
var REPORT_LABELS = {
	pending: "Pending services",
	pms: "PMs",
	modules: "Modules",
	tlc: "TLC & Factors",
	installs: "Install readiness",
	rebuilds: "Rebuilds"
};
var filterInput = object({
	dateFrom: string().nullable().optional(),
	dateTo: string().nullable().optional(),
	tech: string().nullable().optional(),
	customer: string().nullable().optional(),
	status: string().nullable().optional(),
	ak: boolean().nullable().optional()
});
var buildInput = object({
	type: _enum(REPORT_TYPES),
	format: _enum(["xlsx", "csv"]),
	filters: filterInput.optional()
});
var previewExport = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => buildInput.parse(d)).handler(createSsrRpc("111aeb03d57088e20114c3b91137111583695de7837bf7cd602c0b77a80b8751"));
var downloadExport = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => buildInput.parse(d)).handler(createSsrRpc("c4a7418688fc4b7cb7af59b7f9d2eff9d3caace06de75ab3a03f4a37b3217a06"));
var PREFS_KEY = "katz-desk-export";
function readSaved() {
	if (typeof window === "undefined") return {};
	try {
		return JSON.parse(window.localStorage.getItem(PREFS_KEY) || "{}");
	} catch {
		return {};
	}
}
function writeSaved(next) {
	window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
}
function statusesFor(type) {
	if (type === "pms") return [...PM_STATUSES];
	if (type === "modules") return [...MODULE_STATUSES];
	if (type === "installs") return [
		...EQUIP_STATUSES.filter((s) => s !== "Installed"),
		"Not Ready",
		"Ready"
	];
	if (type === "rebuilds") return [...REBUILD_STATUSES];
	return [...CALL_STATUSES];
}
function downloadBase64(filename, mime, base64) {
	const bin = atob(base64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	const blob = new Blob([bytes], { type: mime });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}
function tsvFromReport(report) {
	const parts = [
		`${report.label}`,
		`Generated ${report.generated}`,
		report.filterSummary,
		""
	];
	for (const sheet of report.sheets) {
		if (report.sheets.length > 1) parts.push(sheet.name);
		parts.push(sheet.columns.join("	"));
		for (const row of sheet.rows) parts.push(row.join("	"));
		parts.push("");
	}
	return parts.join("\n");
}
function printReport(report) {
	const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
	if (!w) {
		toast.error("Allow pop-ups to print the report.");
		return;
	}
	const tables = report.sheets.map((sheet) => {
		const head = sheet.columns.map((c) => `<th>${esc(c)}</th>`).join("");
		const body = sheet.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("");
		return `<h2>${esc(sheet.name)}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
	}).join("");
	w.document.write(`<!doctype html><html><head><title>${esc(report.label)}</title>
    <style>
      body { font: 13px/1.4 system-ui, sans-serif; padding: 24px; color: #1a1612; }
      h1 { font-size: 22px; margin: 0 0 4px; }
      p { color: #5c5348; margin: 0 0 16px; }
      h2 { font-size: 14px; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: .08em; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #d7cfc4; padding: 6px 8px; text-align: left; vertical-align: top; }
      th { background: #f4efe8; }
    </style></head><body>
    <h1>${esc(report.label)}</h1>
    <p>${esc(report.generated)} · ${esc(report.filterSummary)}</p>
    ${tables}
    </body></html>`);
	w.document.close();
	w.focus();
	w.print();
}
function esc(s) {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function ExportButton({ defaultType, label }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
		type: "button",
		variant: "outline",
		onClick: () => setOpen(true),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-4" }), label ?? "Export"]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExportDialog, {
		open,
		onOpenChange: setOpen,
		defaultType
	})] });
}
function ExportDialog({ open, onOpenChange, defaultType }) {
	const saved = (0, import_react.useMemo)(() => readSaved(), [open]);
	const [type, setType] = (0, import_react.useState)(defaultType ?? saved.type ?? "pending");
	const [format, setFormat] = (0, import_react.useState)(saved.format ?? "xlsx");
	const [dateFrom, setDateFrom] = (0, import_react.useState)(saved.dateFrom ?? "");
	const [dateTo, setDateTo] = (0, import_react.useState)(saved.dateTo ?? "");
	const [tech, setTech] = (0, import_react.useState)(saved.tech ?? "");
	const [customer, setCustomer] = (0, import_react.useState)(saved.customer ?? "");
	const [status, setStatus] = (0, import_react.useState)(saved.status ?? "");
	const [ak, setAk] = (0, import_react.useState)(!!saved.ak);
	const [report, setReport] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		const next = defaultType ?? readSaved().type ?? "pending";
		if (defaultType) setType(defaultType);
		else setType(next);
	}, [open, defaultType]);
	const filters = {
		dateFrom: dateFrom || null,
		dateTo: dateTo || null,
		tech: tech || null,
		customer: customer || null,
		status: status || null,
		ak: ak || null
	};
	function persist() {
		writeSaved({
			type,
			format,
			dateFrom,
			dateTo,
			tech,
			customer,
			status,
			ak
		});
	}
	const preview = useMutation({
		mutationFn: () => previewExport({ data: {
			type,
			format,
			filters
		} }),
		onSuccess: (data) => {
			setReport(data);
			persist();
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not build report")
	});
	const download = useMutation({
		mutationFn: () => downloadExport({ data: {
			type,
			format,
			filters
		} }),
		onSuccess: (data) => {
			setReport(data.report);
			persist();
			downloadBase64(data.filename, data.mime, data.base64);
			toast.success(`Saved ${data.filename}`);
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not export")
	});
	const statuses = [...new Set(statusesFor(type))];
	const last = report;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "max-h-[90vh] max-w-4xl overflow-y-auto",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Export" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: "One file for the weekly update. KatzDesk labels only — nothing is sent to Corrigo, and customers are not created." }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 grid min-w-0 gap-3 sm:grid-cols-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "export-type",
							children: "Report type"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
							id: "export-type",
							className: "mt-1",
							value: type,
							onChange: (e) => {
								setType(e.target.value);
								setStatus("");
								setReport(null);
							},
							children: REPORT_TYPES.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: t,
								children: REPORT_LABELS[t]
							}, t))
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "export-format",
							children: "Format"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectField, {
							id: "export-format",
							className: "mt-1",
							value: format,
							onChange: (e) => setFormat(e.target.value),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "xlsx",
								children: "Excel (.xlsx)"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "csv",
								children: "CSV"
							})]
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "export-from",
							children: "From"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "export-from",
							type: "date",
							className: "mt-1",
							value: dateFrom,
							onChange: (e) => setDateFrom(e.target.value)
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "export-to",
							children: "To"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "export-to",
							type: "date",
							className: "mt-1",
							value: dateTo,
							onChange: (e) => setDateTo(e.target.value)
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 sm:col-span-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: type === "rebuilds" ? "Owner" : "Tech" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-1 max-w-xs",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TechFilter, {
									value: tech,
									onChange: setTech,
									className: "w-full"
								})
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 sm:col-span-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "export-customer",
								children: "Account"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "export-customer",
								className: "mt-1",
								value: customer,
								onChange: (e) => setCustomer(e.target.value),
								placeholder: "Search account name…"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "sm:col-span-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "export-status",
								children: "Status"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
								id: "export-status",
								className: "mt-1 max-w-xs",
								value: status,
								onChange: (e) => setStatus(e.target.value),
								allowEmpty: true,
								emptyLabel: "Any status",
								children: statuses.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: s,
									children: s
								}, s))
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "sm:col-span-2 flex items-center gap-2 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "checkbox",
								className: "size-4 accent-primary",
								checked: ak,
								onChange: (e) => setAk(e.target.checked)
							}), "AK accounts only"]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 flex flex-wrap gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							onClick: () => download.mutate(),
							disabled: download.isPending,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-4" }), download.isPending ? "Building…" : `Download ${format === "xlsx" ? "Excel" : "CSV"}`]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							variant: "outline",
							onClick: () => preview.mutate(),
							disabled: preview.isPending,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Table2, { className: "size-4" }), preview.isPending ? "Loading…" : "Preview"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "outline",
							disabled: !last,
							onClick: async () => {
								if (!last) return;
								try {
									await navigator.clipboard.writeText(tsvFromReport(last));
									toast.success("Copied as a table");
								} catch {
									toast.error("Could not copy");
								}
							},
							children: "Copy as table"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							variant: "outline",
							disabled: !last,
							onClick: () => last && printReport(last),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Printer, { className: "size-4" }), "Print"]
						})
					]
				}),
				last ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-medium",
								children: last.label
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-muted-foreground",
								children: [
									" · ",
									last.generated,
									" · ",
									last.filterSummary
								]
							})]
						}),
						last.counts ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-sm",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium",
									children: last.counts.notReady
								}),
								" not ready",
								" · ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium",
									children: last.counts.ready
								}),
								" ready"
							]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-3 space-y-4",
							children: last.sheets.map((sheet) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "overflow-auto rounded-xl border border-border",
								children: [
									last.sheets.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "border-b border-border bg-muted/40 px-3 py-2 text-xs tracking-wide text-muted-foreground uppercase",
										children: [
											sheet.name,
											" · ",
											sheet.rows.length
										]
									}) : null,
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
										className: "w-full min-w-[40rem] text-left text-sm",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
											className: "bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: sheet.columns.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "px-3 py-2 font-medium",
												children: c
											}, c)) })
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [sheet.rows.slice(0, 40).map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
											className: "border-t border-border",
											children: row.map((cell, j) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "px-3 py-1.5 align-top",
												children: cell || /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-muted-foreground",
													children: " "
												})
											}, j))
										}, i)), sheet.rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											colSpan: sheet.columns.length,
											className: "px-3 py-6 text-muted-foreground",
											children: "Nothing in this list."
										}) }) : null] })]
									}),
									sheet.rows.length > 40 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "border-t border-border px-3 py-2 text-xs text-muted-foreground",
										children: [
											"Showing 40 of ",
											sheet.rows.length,
											". Download the file for the full list."
										]
									}) : null
								]
							}, sheet.name))
						})
					]
				}) : null
			]
		})
	});
}
//#endregion
export { ExportButton as t };
