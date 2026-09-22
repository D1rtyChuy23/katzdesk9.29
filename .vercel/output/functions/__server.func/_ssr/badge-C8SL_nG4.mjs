import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { _ as cn } from "./router-1NWxggZt.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/badge-C8SL_nG4.js
var import_jsx_runtime = require_jsx_runtime();
var badgeVariants = cva("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tracking-tight", {
	variants: { variant: {
		default: "bg-secondary text-secondary-foreground",
		primary: "bg-primary/12 text-primary",
		danger: "bg-destructive/12 text-destructive",
		warn: "bg-warning/12 text-warning",
		success: "bg-primary/12 text-primary",
		outline: "border border-border text-foreground",
		ink: "bg-ink text-ink-foreground"
	} },
	defaultVariants: { variant: "default" }
});
function Badge({ className, variant, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn(badgeVariants({ variant }), className),
		...props
	});
}
//#endregion
export { Badge as t };
