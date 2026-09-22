import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { _ as cn } from "./router-1NWxggZt.mjs";
import { i as Trigger, n as Portal, r as Root2, t as Content2 } from "../_libs/@radix-ui/react-popover+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/popover-BIqfguoF.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var Popover = Root2;
var PopoverTrigger = Trigger;
function isInsideCombo(target) {
	const node = target;
	const el = node instanceof Element ? node : node?.parentElement;
	if (!el || typeof el.closest !== "function") return false;
	return !!el.closest("[data-combo-popover]");
}
function preventIfCombo(event) {
	if (isInsideCombo(event.target)) event.preventDefault();
}
function PopoverContent({ className, align = "start", sideOffset = 4, ...props }) {
	const [container, setContainer] = import_react.useState(void 0);
	import_react.useLayoutEffect(() => {
		const sheet = document.querySelector(".sheet-panel");
		setContainer(sheet ?? void 0);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Portal, {
		container,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content2, {
			align,
			sideOffset,
			"data-combo-popover": "",
			className: cn("z-[80] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-soft outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95", className),
			...props
		})
	});
}
//#endregion
export { preventIfCombo as i, PopoverContent as n, PopoverTrigger as r, Popover as t };
