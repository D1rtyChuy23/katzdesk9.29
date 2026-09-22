import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { i as useQueryClient, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { i as Label, n as Button, r as Input } from "./input-COYCsX_T.mjs";
import { i as DialogTitle, n as DialogContent, r as DialogDescription, t as Dialog } from "./dialog-zUw3eso-.mjs";
import { t as applySerialPull } from "./serial-pull-CVHfaB5C.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/serial-notice-DcwWIrgz.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function SerialNoticeBanner({ notice }) {
	if (!notice?.trim()) return null;
	const miss = /not found/i.test(notice);
	const warn = /already assigned/i.test(notice);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: `border-b px-5 py-3 text-sm ${miss ? "border-warning/30 bg-warning/10" : warn ? "border-warning/30 bg-warning/10" : "border-primary/20 bg-primary/5"}`,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "font-medium",
			children: notice
		})
	});
}
function SerialPullField({ label, value, onValue, installId, jobId, machineIndex, onPulled }) {
	const qc = useQueryClient();
	const [text, setText] = (0, import_react.useState)(value);
	const [pending, setPending] = (0, import_react.useState)(null);
	const looked = (0, import_react.useRef)("");
	(0, import_react.useEffect)(() => {
		setText(value);
	}, [value]);
	const pull = useMutation({
		mutationFn: (opts) => applySerialPull({ data: {
			serial: opts.serial,
			installId,
			jobId,
			machineIndex: machineIndex ?? null,
			confirmReuse: opts.confirmReuse
		} }),
		onSuccess: (result) => {
			if (result.needsConfirm) {
				setPending(result);
				return;
			}
			setPending(null);
			looked.current = result.serial.trim().replace(/[#\s]/g, "").toLowerCase();
			if (result.serial && result.serial !== text) setText(result.serial);
			onValue(result.serial);
			onPulled?.(result);
			if (result.pulled) toast.success(result.notice);
			else toast.message(result.notice);
			qc.invalidateQueries({ queryKey: ["assets"] });
			qc.invalidateQueries({ queryKey: ["installs"] });
			qc.invalidateQueries({ queryKey: ["jobs"] });
			qc.invalidateQueries({ queryKey: ["job"] });
			qc.invalidateQueries({ queryKey: ["dashboard"] });
		},
		onError: (e) => toast.error(e instanceof Error ? e.message : "Could not check warehouse")
	});
	function commit(raw, confirmReuse = false) {
		const next = raw.trim();
		onValue(next);
		if (!next) {
			looked.current = "";
			return;
		}
		if (!installId && !jobId) return;
		const key = next.replace(/[#\s]/g, "").toLowerCase();
		if (!confirmReuse && key === looked.current) return;
		pull.mutate({
			serial: next,
			confirmReuse
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: label }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
			className: "mt-1",
			value: text,
			autoComplete: "off",
			placeholder: "Type the serial",
			onChange: (e) => {
				setText(e.target.value);
				onValue(e.target.value);
			},
			onBlur: () => {
				if (text.trim()) commit(text);
			},
			onKeyDown: (e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					commit(text);
				}
			}
		}),
		pull.isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 text-xs text-muted-foreground",
			children: "Checking warehouse…"
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
			open: !!pending?.needsConfirm,
			onOpenChange: (o) => !o && setPending(null),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Serial already assigned" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogDescription, { children: [
					pending?.notice,
					" Reuse it on this ",
					installId ? "install" : "ticket",
					", or cancel and leave it where it is."
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 flex flex-wrap justify-end gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						variant: "outline",
						onClick: () => setPending(null),
						children: "Cancel"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						onClick: () => {
							if (pending) commit(pending.serial, true);
						},
						children: "Reuse serial"
					})]
				})
			] })
		})
	] });
}
//#endregion
export { SerialPullField as n, SerialNoticeBanner as t };
