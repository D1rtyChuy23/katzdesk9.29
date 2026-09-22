import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { _ as cn } from "./router-1NWxggZt.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/select-field-BxGIjVBi.js
var import_jsx_runtime = require_jsx_runtime();
function SelectField({ className, children, allowEmpty, emptyLabel = "—", ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
		className: cn("h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className),
		...props,
		children: [allowEmpty ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
			value: "",
			children: emptyLabel
		}) : null, children]
	});
}
//#endregion
export { SelectField as t };
