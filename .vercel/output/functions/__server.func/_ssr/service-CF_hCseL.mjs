import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { i as Route$3 } from "./router-BpVsA2Dc.mjs";
import { t as JobsPage } from "./jobs-page-DCSmPUDE.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/service-CF_hCseL.js
var import_jsx_runtime = require_jsx_runtime();
function Page() {
	const { open } = Route$3.useSearch();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(JobsPage, {
		kind: "service",
		title: "Service tracker",
		lede: "Field calls on a 48-hour clock. Active work stays on top; completed history is one toggle away.",
		initialOpen: open
	});
}
//#endregion
export { Page as component };
