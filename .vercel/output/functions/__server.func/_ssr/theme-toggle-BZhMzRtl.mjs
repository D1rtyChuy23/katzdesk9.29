import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { T as Monitor, f as Sun, w as Moon } from "../_libs/lucide-react.mjs";
import { T as resolvedDark, b as usePrefs } from "./router-1NWxggZt.mjs";
import { n as Button } from "./input-COYCsX_T.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/theme-toggle-BZhMzRtl.js
var import_jsx_runtime = require_jsx_runtime();
function ThemeToggle() {
	const { prefs, update } = usePrefs();
	const dark = resolvedDark(prefs.appearance);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
		type: "button",
		variant: "ghost",
		size: "icon",
		"aria-label": dark ? "Switch to light mode" : "Switch to dark mode",
		title: dark ? "Light mode" : "Dark mode",
		onClick: () => update({ appearance: dark ? "light" : "dark" }),
		children: dark ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sun, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Moon, { className: "size-4" })
	});
}
function AppearanceIcon({ value }) {
	if (value === "dark") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Moon, { className: "size-4" });
	if (value === "light") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sun, { className: "size-4" });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Monitor, { className: "size-4" });
}
//#endregion
export { ThemeToggle as n, AppearanceIcon as t };
