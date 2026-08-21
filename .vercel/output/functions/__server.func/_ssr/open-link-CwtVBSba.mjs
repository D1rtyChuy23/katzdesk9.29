import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/open-link-CwtVBSba.js
var import_jsx_runtime = require_jsx_runtime();
var ROUTES = {
	service: "/service",
	tlc: "/tlc",
	pm: "/pms",
	install: "/installs",
	deal: "/pipeline",
	module: "/modules",
	asset: "/warehouse",
	location: "/locations",
	recipe: "/recipes",
	handoff: "/handoff"
};
function isKind(v) {
	return v in ROUTES;
}
function OpenLink({ entityType, id, className, children }) {
	if (!isKind(entityType)) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
		to: "/",
		className,
		children
	});
	const to = ROUTES[entityType];
	if (!id || entityType === "handoff") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
		to,
		className,
		children
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
		to,
		search: { open: id },
		className,
		children
	});
}
function pathFor(entityType) {
	return isKind(entityType) ? ROUTES[entityType] : "/";
}
//#endregion
export { pathFor as n, OpenLink as t };
