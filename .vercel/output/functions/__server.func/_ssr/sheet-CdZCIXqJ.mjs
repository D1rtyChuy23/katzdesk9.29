import "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { t as X } from "../_libs/lucide-react.mjs";
import { _ as cn } from "./router-1NWxggZt.mjs";
import { a as DialogOverlay, n as DialogClose, o as DialogPortal, r as DialogContent, s as DialogTitle, t as Dialog } from "../_libs/@radix-ui/react-dialog+[...].mjs";
import { i as preventIfCombo } from "./popover-BIqfguoF.mjs";
require_react();
var import_jsx_runtime = require_jsx_runtime();
var Sheet = Dialog;
function SheetContent({ className, children, side = "right", onPointerDownOutside, onFocusOutside, onInteractOutside, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, { className: "fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
		className: cn("sheet-panel fixed inset-y-0 top-0 z-50 flex h-dvh max-h-dvh w-full flex-col overflow-hidden overscroll-none border-border bg-card shadow-soft focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out sm:max-w-xl", side === "right" ? "right-0 border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right" : "left-0 border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left", className),
		onPointerDownOutside: (e) => {
			preventIfCombo(e);
			onPointerDownOutside?.(e);
		},
		onFocusOutside: (e) => {
			preventIfCombo(e);
			onFocusOutside?.(e);
		},
		onInteractOutside: (e) => {
			preventIfCombo(e);
			onInteractOutside?.(e);
		},
		...props,
		children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogClose, {
			className: "absolute top-3 right-3 z-10 rounded-sm p-1 text-muted-foreground hover:bg-muted",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "sr-only",
				children: "Close"
			})]
		})]
	})] });
}
function SheetHeader({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("shrink-0 border-b border-border px-5 py-4 pr-12", className),
		...props
	});
}
function SheetBody({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("sheet-scroll min-h-0 flex-1 overflow-y-scroll overscroll-contain", className),
		...props
	});
}
function SheetTitle({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, {
		className: cn("font-display text-xl font-medium tracking-tight", className),
		...props
	});
}
//#endregion
export { SheetTitle as a, SheetHeader as i, SheetBody as n, SheetContent as r, Sheet as t };
