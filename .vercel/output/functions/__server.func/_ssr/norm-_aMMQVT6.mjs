//#region node_modules/.nitro/vite/services/ssr/assets/norm-_aMMQVT6.js
/** Person-name compare key: trim, case-fold, drop apostrophes, collapse space. */
function normalizeName(raw) {
	return (raw ?? "").trim().toLowerCase().replace(/['’]/g, "").replace(/\s+/g, " ");
}
//#endregion
export { normalizeName as t };
