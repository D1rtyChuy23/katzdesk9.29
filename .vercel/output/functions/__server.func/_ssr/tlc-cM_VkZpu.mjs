import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { r as Route$2 } from "./router-BpVsA2Dc.mjs";
import { t as JobsPage } from "./jobs-page-DCSmPUDE.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/tlc-cM_VkZpu.js
var import_jsx_runtime = require_jsx_runtime();
function Page() {
	const { open } = Route$2.useSearch();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(JobsPage, {
		kind: "tlc",
		title: "TLC + Factor",
		lede: "Contract TLC and Factor visits. Anything still open past two weeks is flagged automatically.",
		initialOpen: open
	});
}
//#endregion
export { Page as component };
