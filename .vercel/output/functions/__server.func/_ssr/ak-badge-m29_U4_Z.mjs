import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { _ as cn } from "./router-1NWxggZt.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ak-badge-m29_U4_Z.js
var import_jsx_runtime = require_jsx_runtime();
function AkBadge({ on, className }) {
	if (!on) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex h-5 items-center rounded-sm bg-ink px-1.5 text-[10px] font-semibold tracking-wide text-cream", className),
		title: "Avi Katz account",
		children: "AK"
	});
}
function NoRepFlag({ show, className }) {
	if (!show) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("text-[11px] font-medium text-warning", className),
		children: "No rep assigned"
	});
}
//#endregion
export { NoRepFlag as n, AkBadge as t };
